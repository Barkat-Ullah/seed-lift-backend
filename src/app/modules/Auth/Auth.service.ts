import sendOtpViaMail, { generateOtpEmail } from './../../utils/sendMail';
import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret, SignOptions } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import { SkillCategory, UserRoleEnum, UserStatus } from '@prisma/client';
import { Response } from 'express';
import {
  getOtpStatusMessage,
  otpExpiryTime,
  generateOTP,
} from '../../utils/otp';
import sendResponse from '../../utils/sendResponse';
import { generateToken } from '../../utils/generateToken';
import { insecurePrisma, prisma } from '../../utils/prisma';
import emailSender from './../../utils/sendMail';
import { toStringArray } from './Auth.constant';

// ======================== LOGIN WITH OTP ========================
const loginWithOtpFromDB = async (
  res: Response,
  payload: { email: string; password: string },
) => {
  const userData = await insecurePrisma.user.findUniqueOrThrow({
    where: { email: payload.email },
    include: {
      admin: { select: { fullName: true } },
      founder: { select: { fullName: true } },
      seeder: { select: { fullName: true } },
    },
  });

  const fullName =
    userData.admin?.fullName ||
    userData.founder?.fullName ||
    userData.seeder?.fullName;

  const isCorrectPassword = await bcrypt.compare(
    payload.password,
    userData.password,
  );
  if (!isCorrectPassword)
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect');

  if (userData.role !== UserRoleEnum.ADMIN && !userData.isEmailVerified) {
    const otp = generateOTP().toString();

    await prisma.user.update({
      where: { email: userData.email },
      data: {
        otp,
        otpExpiry: otpExpiryTime(),
      },
    });

    sendOtpViaMail(payload.email, otp, 'OTP Verification');

    sendResponse(res, {
      statusCode: httpStatus.OK,
      message: 'Please check your email for the verification OTP.',
      data: '',
    });
  } else {
    const accessToken = await generateToken(
      {
        id: userData.id,
        name: fullName as string,
        email: userData.email,
        role: userData.role,
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as SignOptions['expiresIn'],
    );

    return {
      id: userData.id,
      name: fullName,
      email: userData.email,
      role: userData.role,
      accessToken,
    };
  }
};

// ======================== REGISTER WITH OTP ========================
const registerWithOtpIntoDB = async (payload: any) => {
  if (!payload?.email || !payload?.password) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Missing required fields');
  }

  const exists = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true },
  });
  if (exists) throw new AppError(httpStatus.CONFLICT, 'User already exists');

  const hashedPassword = await bcrypt.hash(payload.password, 12);
  const otp = generateOTP().toString();

  const skills = (payload.skill as string[])
    .map(s => s.trim())
    .filter((s): s is SkillCategory =>
      Object.values(SkillCategory).includes(s as SkillCategory),
    );
  try {
    await prisma.$transaction(async tx => {
      const newUser = await tx.user.create({
        data: {
          email: payload.email,
          password: hashedPassword,
          role: payload.role,
          otp,
          otpExpiry: otpExpiryTime(),
        },
      });

      if (payload.role === UserRoleEnum.SEEDER) {
        await tx.seeder.create({
          data: {
            fullName: payload.fullName,
            email: payload.email,
            phoneNumber: payload.phoneNumber ?? undefined,
            skill: skills,
            description: payload.description ?? undefined,
          },
        });
      } else if (payload.role === UserRoleEnum.FOUNDER) {
        await tx.founder.create({
          data: {
            fullName: payload.fullName,
            email: payload.email,
            phoneNumber: payload.phoneNumber ?? undefined,
            description: payload.description ?? undefined,
            businessName: payload.businessName ?? undefined,
            orgType: payload.orgType ?? undefined,
          },
        });
      } else {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'Invalid role for registration',
        );
      }

      const html = generateOtpEmail(otp);
      await emailSender(newUser.email, html, 'OTP Verification');
    });
  } catch (err) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create user',
    );
  }

  return {
    message: 'Please check your email for OTP and verify your account.',
  };
};

// ======================== COMMON OTP VERIFY (REGISTER + FORGOT) ========================
const verifyOtpCommon = async (payload: { email: string; otp: string }) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
    select: {
      id: true,
      email: true,
      otp: true,
      otpExpiry: true,
      isEmailVerified: true,
      role: true,
      admin: { select: { fullName: true } },
      founder: { select: { fullName: true } },
      seeder: { select: { fullName: true } },
    },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found!');

  const fullName =
    user.admin?.fullName || user.founder?.fullName || user.seeder?.fullName;

  if (
    !user.otp ||
    user.otp !== payload.otp ||
    !user.otpExpiry ||
    new Date(user.otpExpiry).getTime() < Date.now()
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
  }

  let message = 'OTP verified successfully!';

  if (user.isEmailVerified === false) {
    await prisma.user.update({
      where: { email: user.email },
      data: { otp: null, otpExpiry: null, isEmailVerified: true },
    });

    message = 'Email verified successfully!';

    // Generate access token for registration flow
    const accessToken = await generateToken(
      {
        id: user.id,
        name: fullName as string,
        email: user.email,
        role: user.role,
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as SignOptions['expiresIn'],
    );

    return {
      message,
      accessToken,
      id: user.id,
      name: fullName,
      email: user.email,
      role: user.role,
    };
  }
  // Step 5: Handle forgot password case
  else {
    await prisma.user.update({
      where: { email: user.email },
      data: { otp: null, otpExpiry: null },
    });

    message = 'OTP verified for password reset!';
    return { message };
  }
};

// ======================== RESEND OTP ========================
const resendVerificationWithOtp = async (email: string) => {
  const user = await insecurePrisma.user.findFirstOrThrow({ where: { email } });

  if (user.status === UserStatus.RESTRICTED) {
    throw new AppError(httpStatus.FORBIDDEN, 'User is Suspended');
  }

  if (user.isEmailVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Email is already verified');
  }

  const otp = generateOTP().toString();
  const expiry = otpExpiryTime();

  await prisma.user.update({
    where: { email },
    data: { otp, otpExpiry: expiry },
  });

  try {
    await sendOtpViaMail(email, otp, 'OTP Verification');
  } catch {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to send OTP email',
    );
  }

  return {
    message: 'Verification OTP sent successfully. Please check your inbox.',
  };
};

// ======================== CHANGE PASSWORD ========================
const changePassword = async (user: any, payload: any) => {
  const userData = await insecurePrisma.user.findUniqueOrThrow({
    where: { email: user.email, status: UserStatus.ACTIVE },
  });

  const isCorrectPassword = await bcrypt.compare(
    payload.oldPassword,
    userData.password,
  );
  if (!isCorrectPassword)
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect!');

  const hashedPassword = await bcrypt.hash(payload.newPassword, 12);

  await prisma.user.update({
    where: { id: userData.id },
    data: { password: hashedPassword },
  });

  return { message: 'Password changed successfully!' };
};

// ======================== FORGOT PASSWORD ========================
const forgetPassword = async (email: string) => {
  const userData = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { email: true, status: true, id: true, otpExpiry: true, otp: true },
  });

  if (userData.status === UserStatus.RESTRICTED) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User has been suspended');
  }

  if (
    userData.otp &&
    userData.otpExpiry &&
    new Date(userData.otpExpiry).getTime() > Date.now()
  ) {
    const message = getOtpStatusMessage(userData.otpExpiry);
    throw new AppError(httpStatus.CONFLICT, message);
  }

  const otp = generateOTP().toString();
  const expireTime = otpExpiryTime();

  try {
    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { email },
        data: { otp, otpExpiry: expireTime },
      });

      try {
        const html = generateOtpEmail(otp);
        await emailSender(userData.email, html, 'OTP Verification');
      } catch {
        await tx.user.update({
          where: { email },
          data: { otp: null, otpExpiry: null },
        });
        throw new AppError(
          httpStatus.INTERNAL_SERVER_ERROR,
          'Failed to send OTP email',
        );
      }
    });
  } catch {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to send OTP');
  }
};

// ======================== RESET PASSWORD ========================
const resetPassword = async (payload: { password: string; email: string }) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });
  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found!');

  const hashedPassword = await bcrypt.hash(payload.password, 12);

  await prisma.user.update({
    where: { email: payload.email },
    data: { password: hashedPassword, otp: null, otpExpiry: null },
  });

  return { message: 'Password reset successfully' };
};

// ======================== EXPORT ========================
export const AuthServices = {
  loginWithOtpFromDB,
  registerWithOtpIntoDB,
  resendVerificationWithOtp,
  changePassword,
  forgetPassword,
  resetPassword,
  verifyOtpCommon,
};
