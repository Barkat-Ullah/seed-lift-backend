import httpStatus from 'http-status';
import {
  LevelEnum,
  OrgTypeEnum,
  User,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import QueryBuilder from '../../builder/QueryBuilder';
import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';
import { uploadToDigitalOceanAWS } from '../../utils/uploadToDigitalOceanAWS';
import {
  getLevelByCoins,
  hasActiveSubscription,
  LEVEL_CONFIG,
} from '../Seeder/Seeder.helper';
import { fileUploader } from '../../utils/uploadCloudinary';

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

  // await prisma.founder.updateMany({
  //   data: {
  //     orgType: OrgTypeEnum.AI,
  //   },
  // });

  return {
    ...result,
    data: result.data,
  };
};

const getMyProfileFromDB = async (id: string) => {
  const user = await prisma.user.findUnique({
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

  if (!user) {
    throw new AppError(401, 'User not found');
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
        email: true,
        profile: true,
        phoneNumber: true,
        description: true,
        skill: true,
        isPro: true,
        level: true,
        coin: true,
        subscriptionStart: true,
        subscriptionEnd: true,
        subscription: { select: { id: true } },
        comment: {
          where: {
            // seederId: id,
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
        subscription: {
          select: {
            id: true,
            title: true,
            price: true,
            duration: true,
          },
        },
        subscriptionStart: true,
        subscriptionEnd: true,
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

  let profileInfo: any = null;
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
        isPro: true,
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
      console.log({ profileInfo });
      const hasSubscription = hasActiveSubscription(profileInfo);
      // const coins = seeder.coin || 0;
      const currentLevel = profileInfo?.level;
      const levelInfo = LEVEL_CONFIG[currentLevel as keyof typeof LEVEL_CONFIG];

      const allSeeders = await prisma.seeder.findMany({
        select: {
          id: true,
          level: true,
          coin: true,
          subscriptionStart: true,
          subscriptionEnd: true,
        },
      });

      const rankedSeeders = allSeeders
        .map(s => ({
          ...s,
          hasSubscription: hasActiveSubscription(s),
          levelPriority:
            LEVEL_CONFIG[s.level as keyof typeof LEVEL_CONFIG]?.priority || 5,
        }))
        .sort((a, b) => {
          if (a.hasSubscription !== b.hasSubscription) {
            return a.hasSubscription ? -1 : 1;
          }
          if (a.levelPriority !== b.levelPriority) {
            return a.levelPriority - b.levelPriority;
          }
          return (b.coin || 0) - (a.coin || 0);
        });
      // console.log({rankedSeeders})

      const rank = rankedSeeders.findIndex(s => s.id === profileInfo.id) + 1;

      let founderReplyCount = 0;
      try {
        founderReplyCount = await prisma.comment.count({
          where: {
            parent: {
              seederId: profileInfo.id,
            },
            isFounderReply: true,
          },
        });
      } catch (error) {
        console.error('Error fetching founder reply count:', error);
        founderReplyCount = 0;
      }
      profileInfo = {
        ...profileInfo,
        hasSubscription,
        levelInfo,
        currentRank: rank,
        totalWins: profileInfo.comment?.length || 0,
        totalReplies: founderReplyCount,
        successRate:
          profileInfo._count.comment > 0
            ? Math.round(
                (profileInfo?.comment?.length / profileInfo?._count?.comment) *
                  100,
              )
            : 0,
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

// const updateUserRoleStatusIntoDB = async (id: string, role: UserRoleEnum) => {
//   const result = await prisma.user.update({
//     where: {
//       id: id,
//     },
//     data: {
//       role: role,
//     },
//   });
//   return result;
// };

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

  // if (profileFile) {
  //   const uploaded = await uploadToDigitalOceanAWS(profileFile);
  //   profileUrl = uploaded.Location;
  // }

  if (profileFile) {
    const result = await fileUploader.uploadToCloudinary(profileFile);
    profileUrl = result.Location;
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
        isPro: true,
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
