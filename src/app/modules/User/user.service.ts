import httpStatus from 'http-status';
import { User, UserRoleEnum, UserStatus } from '@prisma/client';
import QueryBuilder from '../../builder/QueryBuilder';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';
import { uploadToDigitalOceanAWS } from '../../utils/uploadToDigitalOceanAWS';
import { getLevelByCoins } from '../Seeder/Seeder.helper';

interface UserWithOptionalPassword extends Omit<User, 'password'> {
  password?: string;
}

const getAllUsersFromDB = async (query: any) => {
  const usersQuery = new QueryBuilder<typeof prisma.user>(prisma.user, query);
  usersQuery.where({
    role: {
      in: [UserRoleEnum.SEEDER, UserRoleEnum.FOUNDER],
    },
  });
  const result = await usersQuery
    .search([
      'seeder.fullName',
      'founder.fullName',
      'email',
      'seeder.description',
      'founder.description',
    ])
    .filter()
    .where({
      isDeleted: false,
    })
    .sort()
    .fields()
    .exclude()
    .paginate()
    .customFields({
      id: true,
      email: true,
      role: true,
      status: true,
      seeder: {
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
        },
      },
      founder: {
        select: {
          id: true,
          fullName: true,
          phoneNumber: true,
        },
      },
    })
    .execute();

  return {
    ...result,
    data: result.data,
  };
};

const getMyProfileFromDB = async (id: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: {
      id,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
    },
  });

  let profileInfo = null;

  if (user.role === UserRoleEnum.ADMIN) {
    profileInfo = await prisma.admin.findUnique({
      where: { email: user.email },
      select: {
        id: true,
        fullName: true,
        profile: true,
        phoneNumber: true,
        address: true,
      },
    });
  } else if (user.role === UserRoleEnum.SEEDER) {
    profileInfo = await prisma.seeder.findUnique({
      where: { email: user.email },
      select: {
        id: true,
        fullName: true,
        email: true,
        profile: true,
        phoneNumber: true,
        description: true,
        skill: true,
        isVerified: true,
        level: true,
        coin: true,
        subscriptionStart: true,
        subscriptionEnd: true,
        subscription: { select: { id: true } },
        comment: {
          where: {
            seederId: id,
            isWin: true,
            challenge: { isAwarded: true },
          },
          select: {
            id: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            comment: true,
          },
        },
      },
    });
    if (profileInfo) {
      const currentCoins = profileInfo.coin || 0;
      const newLevel = getLevelByCoins(currentCoins);

      if (newLevel !== profileInfo.level) {
        await prisma.seeder.update({
          where: { id: profileInfo.id },
          data: { level: newLevel },
        });

        profileInfo.level = newLevel;
      }
    }
  } else if (user.role === UserRoleEnum.FOUNDER) {
    profileInfo = await prisma.founder.findUnique({
      where: { email: user.email },
      select: {
        id: true,
        fullName: true,
        email: true,
        profile: true,
        phoneNumber: true,
        description: true,
        businessName: true,
        orgType: true,
      },
    });
  }

  if (!profileInfo) {
    throw new AppError(httpStatus.NOT_FOUND, 'Profile not found!');
  }

  return {
    ...user,
    profile: profileInfo,
  };
};

const getUserDetailsFromDB = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      isDeleted: true,
      isEmailVerified: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  let profileInfo = null;
  if (user.role === UserRoleEnum.ADMIN) {
    profileInfo = await prisma.admin.findUnique({
      where: { email: user.email },
      select: {
        id: true,
        fullName: true,
        profile: true,
        phoneNumber: true,
        address: true,
      },
    });
  } else if (user.role === UserRoleEnum.SEEDER) {
    profileInfo = await prisma.seeder.findUnique({
      where: { email: user.email },
      select: {
        id: true,
        fullName: true,
        description: true,
        email: true,
        profile: true,
        phoneNumber: true,
        skill: true,
        isVerified: true,
        level: true,
        coin: true,
        subscriptionStart: true,
        subscriptionEnd: true,
        subscription: { select: { id: true } },
        comment: {
          where: {
            isWin: true,
            challenge: { isAwarded: true },
          },
          select: { id: true },
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { comment: true },
        },
      },
    });
    if (profileInfo) {
      const founderReplyCount = await prisma.comment.count({
        where: {
          parent: {
            seederId: profileInfo.id,
          },
          isFounderReply: true,
        },
      });
      profileInfo = {
        ...profileInfo,
        founderReplyCount,
      };
    }
  } else if (user.role === UserRoleEnum.FOUNDER) {
    profileInfo = await prisma.founder.findUnique({
      where: { email: user.email },
      select: {
        id: true,
        fullName: true,
        email: true,
        profile: true,
        phoneNumber: true,
        description: true,
        businessName: true,
        orgType: true,
        subscription: {
          select: {
            id: true,
          },
        },
      },
    });

    if (profileInfo) {
      const totalChallenges = await prisma.challenge.count({
        where: { founderId: profileInfo.id },
      });
      const awardedChallenges = await prisma.challenge.count({
        where: { founderId: profileInfo.id, isAwarded: true },
      });
      profileInfo = {
        ...profileInfo,
        totalChallenges,
        awardedChallenges,
      };
    }
  }

  if (!profileInfo) {
    throw new AppError(httpStatus.NOT_FOUND, 'Profile details not found!');
  }

  return {
    ...user,
    profile: profileInfo,
  };
};

const updateUserStatus = async (userId: string, adminId: string) => {
  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== UserRoleEnum.ADMIN) {
    throw new AppError(httpStatus.FORBIDDEN, 'Only admin can approve');
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');

  const newStatus =
    user.status === UserStatus.ACTIVE
      ? UserStatus.RESTRICTED
      : UserStatus.ACTIVE;

  const result = await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      founder: { select: { fullName: true } },
      seeder: { select: { fullName: true } },
    },
  });

  return result;
};

const softDeleteUserIntoDB = async (id: string) => {
  const result = await prisma.user.update({
    where: { id },
    data: { isDeleted: true },
    select: {
      id: true,
      isDeleted: true,
    },
  });
  return result;
};

const hardDeleteUserIntoDB = async (id: string, adminId: string) => {
  // TODO: Implement transaction for deleting related records (e.g., challenges, rooms, chats) based on your models
  // For now, just delete the user
  const deletedUser = await prisma.user.delete({
    where: { id },
    select: { id: true, email: true },
  });
  return deletedUser;
};

const updateMyProfile = async (
  userId: string,
  role: UserRoleEnum,
  profileFile?: Express.Multer.File,
  payload?: any,
) => {
  // 1️⃣ Get user to fetch email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) throw new Error('User not found');

  let profileUrl: string | null = null;

  if (profileFile) {
    const uploaded = await uploadToDigitalOceanAWS(profileFile);
    profileUrl = uploaded.Location;
  }

  const updateData: any = { ...payload };
  if (profileUrl) updateData.profile = profileUrl;

  if (role === UserRoleEnum.ADMIN) {
    return await prisma.admin.update({
      where: { email: user.email },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        profile: true,
        phoneNumber: true,
        address: true,
      },
    });
  }

  if (role === UserRoleEnum.FOUNDER) {
    return await prisma.founder.update({
      where: { email: user.email },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        profile: true,
        phoneNumber: true,
        description: true,
        businessName: true,
        orgType: true,
      },
    });
  }

  if (role === UserRoleEnum.SEEDER) {
    return await prisma.seeder.update({
      where: { email: user.email },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        profile: true,
        phoneNumber: true,
        description: true,
        skill: true,
        isVerified: true,
        level: true,
        coin: true,
      },
    });
  }
};

export const UserServices = {
  getAllUsersFromDB,
  getMyProfileFromDB,
  getUserDetailsFromDB,
  updateUserStatus,
  softDeleteUserIntoDB,
  hardDeleteUserIntoDB,
  updateMyProfile,
};
