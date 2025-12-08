import { Request } from 'express';
import { prisma } from '../../utils/prisma';
import { uploadToDigitalOceanAWS } from '../../utils/uploadToDigitalOceanAWS';
import {
  ChallengeStatus,
  ChallengeCategory,
  ChallengeType,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { hasActiveSubscription } from '../Seeder/Seeder.helper';
import { updateChallengesWithRemainingDays } from './Challenge.constrant';
import { fileUploader } from '../../utils/uploadCloudinary';
import { createBulkNotifications } from '../../constant/notify';

const createIntoDb = async (req: Request) => {
  const {
    // inviteTalents,
    status,
    deadline,
    seedPoints,
    tags,
    category,
    description,
    title,
    challengeType,
  } = JSON.parse(req.body.data);

  const founderMail = req.user.email;

  // Find founder
  const founder = await prisma.founder.findUnique({
    where: {
      email: founderMail,
    },
  });

  if (!founder) {
    throw new AppError(httpStatus.NOT_FOUND, 'Founder not found');
  }

  // Handle attachment upload
  let attachmentUrl = null;
  if (req.file) {
    // const location = await uploadToDigitalOceanAWS(req.file);
    const location = await fileUploader.uploadToCloudinary(req.file);
    attachmentUrl = location.Location;
  }

  // Parse inviteTalents and tags if they're strings
  // const parsedInviteTalents =
  //   typeof inviteTalents === 'string'
  //     ? JSON.parse(inviteTalents)
  //     : inviteTalents || [];

  const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags || [];

  // Create challenge
  const challenge = await prisma.challenge.create({
    data: {
      challengeType: challengeType as ChallengeType,
      title,
      description,
      category: category as ChallengeCategory,
      attachment: attachmentUrl,
      tags: parsedTags,
      seedPoints: parseInt(seedPoints),
      deadline: new Date(deadline),
      status: (status as ChallengeStatus) || ChallengeStatus.PENDING,
      // inviteTalents: parsedInviteTalents ,
      founderId: founder.id,
    },
  });
  //*notify
  if (challengeType === ChallengeType.Public) {
    const seeders = await prisma.seeder.findMany({
      where: {
        user: {
          isDeleted: false,
          status: UserStatus.ACTIVE,
        },
      },
      include: {
        user: {
          include: {
            founder: {
              select: {
                id: true,
              },
            },
            seeder: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    //* notifications
    const notifications = seeders.map(seeder => ({
      receiverId: seeder.id,
      senderId: founder.id,
      title: 'New Challenge Available',
      body: `${founder.fullName} posted a new challenge: ${title}`,
    }));

    if (notifications.length > 0) {
      await createBulkNotifications(notifications);
    }
  } else if (
    challengeType === ChallengeType.Private 
  ) {
    if (category) {
      const matchSkillSeeders = await prisma.seeder.findMany({
        where: {
          skill: {
            has: category,
          },
          user: {
            isDeleted: false,
            status: UserStatus.ACTIVE,
          },
        },
      });

      const notifications = matchSkillSeeders.map(seeder => ({
        receiverId: seeder.id,
        senderId: founder.id,
        title: 'You Are Invited to a Challenge',
        body: `${founder.fullName} invited you to: ${title}`,
      }));

      if (notifications.length > 0) {
        await createBulkNotifications(notifications);
      }
    }
  }

  return challenge;
};

const getAllChallenge = async (
  query: Record<string, any>,
  seederMail: string,
) => {
  const {
    searchTerm,
    category,
    challengeType,
    tags,
    minSeedPoints,
    maxSeedPoints,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
  } = query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where: any = {
    isDeleted: false,
    isActive: true,
    isAwarded: false,
    status: ChallengeStatus.PENDING,
  };

  if (searchTerm) {
    where.OR = [
      { title: { contains: searchTerm, mode: 'insensitive' } },
      { description: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  if (category) where.category = category;

  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    where.tags = { hasSome: tagArray };
  }

  if (minSeedPoints || maxSeedPoints) {
    where.seedPoints = {};
    if (minSeedPoints) where.seedPoints.gte = parseInt(minSeedPoints);
    if (maxSeedPoints) where.seedPoints.lte = parseInt(maxSeedPoints);
  }

  if (challengeType) {
    where.challengeType = challengeType;
  }

  const seeder = await prisma.seeder.findUnique({
    where: {
      email: seederMail,
    },
    select: {
      id: true,
      fullName: true,
      isPro: true,
      subscription: true,
      subscriptionStart: true,
      subscriptionEnd: true,
      skill: true,
    },
  });

  const allChallenges = await prisma.challenge.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    select: {
      id: true,
      title: true,
      challengeType: true,
      description: true,
      category: true,
      attachment: true,
      tags: true,
      seedPoints: true,
      deadline: true,
      status: true,
      isActive: true,
      isDeleted: true,
      isAwarded: true,
      inviteTalents: true,
      _count: {
        select: {
          react: true,
          comment: true,
        },
      },
      react: {
        where: {
          seederId: seeder?.id,
        },
        take: 1,
        select: {
          isReact: true,
        },
      },
      founder: {
        select: {
          id: true,
          email: true,
          fullName: true,
          profile: true,
          subscriptionId: true,
          user: {
            select: {
              role: true,
            },
          },
        },
      },
      createdAt: true,
    },
  });

  const now = new Date();

  const updatedAllChallenges = await updateChallengesWithRemainingDays(
    allChallenges,
    now,
  );

  const processedChallenges = updatedAllChallenges.map(challenge => ({
    ...challenge,
    isReact: challenge.react[0]?.isReact ?? false,
  }));
  //*include seeder
  let filteredChallenges = processedChallenges.filter(challenge => {
    if (challenge.challengeType === 'Public') {
      return true;
    }
    if (!seeder || !seeder.id) {
      return false;
    }
    return challenge.inviteTalents.includes(seeder.id);
  });

  let finalChallenges = filteredChallenges;
  if (seeder && seeder.id) {
    const hasSubscription = seeder.isPro || hasActiveSubscription(seeder);
    const seederSkills = seeder.skill || [];

    finalChallenges = filteredChallenges
      .map(challenge => {
        let score = 0;
        const isMatch = seederSkills.includes(challenge.category);

        if (isMatch) {
          score += 2;
          if (hasSubscription) {
            score += 1;
          }
        }
        return { ...challenge, _tempScore: score };
      })
      .sort((a, b) => {
        if (a._tempScore !== b._tempScore) {
          return b._tempScore - a._tempScore;
        }

        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      })
      .map(({ _tempScore, ...challenge }) => challenge)
      .slice(skip, skip + take);
  } else {
    finalChallenges = filteredChallenges
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(skip, skip + take);
  }

  const total = filteredChallenges.length;

  return {
    data: finalChallenges,
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

const getAllAdminChallenge = async (query: Record<string, any>) => {
  const {
    searchTerm,
    category,
    challengeType,
    tags,
    minSeedPoints,
    maxSeedPoints,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 10,
  } = query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where: any = {};

  if (searchTerm) {
    where.OR = [
      { title: { contains: searchTerm, mode: 'insensitive' } },
      { description: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  if (category) where.category = category;

  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    where.tags = { hasSome: tagArray };
  }

  if (minSeedPoints || maxSeedPoints) {
    where.seedPoints = {};
    if (minSeedPoints) where.seedPoints.gte = parseInt(minSeedPoints);
    if (maxSeedPoints) where.seedPoints.lte = parseInt(maxSeedPoints);
  }

  if (challengeType) {
    where.challengeType = challengeType;
  }

  // ⭐ Total count (without pagination)
  const total = await prisma.challenge.count({ where });

  // ⭐ Pagination + Sorting
  const allChallenges = await prisma.challenge.findMany({
    where,
    skip,
    take,
    orderBy: { [sortBy]: sortOrder },
  });

  return {
    data: allChallenges,
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

const getMyChallenge = async (email: string, query: Record<string, any>) => {
  const { status } = query;
  const founder = await prisma.founder.findUnique({
    where: { email },
  });

  if (!founder) {
    throw new AppError(httpStatus.NOT_FOUND, 'Founder not found');
  }

  const where: any = {
    founderId: founder?.id,
    isDeleted: false,
    status: { in: [ChallengeStatus.PENDING, ChallengeStatus.FINISHED] },
  };

  if (status) {
    where.status = status;
  }

  const challenges = await prisma.challenge.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      title: true,
      description: true,
      challengeType: true,
      category: true,
      attachment: true,
      tags: true,
      seedPoints: true,
      deadline: true,
      status: true,
      isActive: true,
      isDeleted: true,
      isAwarded: true,
      inviteTalents: true,
      _count: {
        select: {
          react: true,
          comment: true,
        },
      },
      react: {
        where: {
          founderId: founder.id,
        },
        take: 1,
        select: {
          isReact: true,
        },
      },
      founder: {
        select: {
          id: true,
          email: true,
          fullName: true,
          profile: true,
          user: {
            select: {
              role: true,
            },
          },
        },
      },
    },
  });

  // Extract isReact and transform challenges
  const transformedChallenges = challenges.map(challenge => {
    const { react, ...rest } = challenge;
    return {
      ...rest,
      isReact: react.length > 0 ? react[0].isReact : false,
      _count: {
        ...challenge._count,
      },
    };
  });

  const totalChallenge = await prisma.challenge.count({
    where: {
      founderId: founder.id,
    },
  });
  const activeChallenge = await prisma.challenge.count({
    where: {
      isActive: true,
      isAwarded: false,
      isDeleted: false,
      status: ChallengeStatus.PENDING,
    },
  });

  return {
    totalChallenge,
    activeChallenge,
    challenges: transformedChallenges,
  };
};

const getChallengeByIdFromDB = async (id: string) => {
  const challenge = await prisma.challenge.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      challengeType: true,
      category: true,
      attachment: true,
      tags: true,
      seedPoints: true,
      deadline: true,
      status: true,
      isActive: true,
      isDeleted: true,
      inviteTalents: true,
      founder: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
      comment: {
        include: {
          seeder: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
          replies: {
            include: {
              seeder: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                },
              },
            },
          },
        },
        where: {
          parentId: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!challenge) {
    throw new AppError(httpStatus.NOT_FOUND, 'Challenge not found');
  }

  if (challenge.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Challenge has been deleted');
  }

  return challenge;
};

const updateIntoDb = async (
  id: string,
  data: Partial<any>,
  file?: Express.Multer.File,
) => {
  // Check if challenge exists
  const existingChallenge = await prisma.challenge.findUnique({
    where: { id },
  });

  if (!existingChallenge) {
    throw new AppError(httpStatus.NOT_FOUND, 'Challenge not found');
  }

  if (existingChallenge.isDeleted) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cannot update deleted challenge',
    );
  }

  let attachment: string | null = null;

  if (file) {
    const uploaded = await uploadToDigitalOceanAWS(file);
    attachment = uploaded.Location;
  }

  // Prepare update data
  const updateData: any = {};

  if (data.title) updateData.title = data.title;
  if (data.description) updateData.description = data.description;
  if (data.category) updateData.category = data.category;
  if (data.tags) updateData.tags = data.tags;
  if (data.seedPoints) updateData.seedPoints = parseInt(data.seedPoints);
  if (data.deadline) updateData.deadline = new Date(data.deadline);

  const finalUpdatedData = { ...updateData, attachment };

  // Update challenge
  const updatedChallenge = await prisma.challenge.update({
    where: { id },
    data: finalUpdatedData,
    include: {
      founder: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
  });

  return updatedChallenge;
};

const softDeleteIntoDb = async (id: string) => {
  // Check if challenge exists
  const existingChallenge = await prisma.challenge.findUnique({
    where: { id },
  });

  if (!existingChallenge) {
    throw new AppError(httpStatus.NOT_FOUND, 'Challenge not found');
  }

  if (existingChallenge.isDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Challenge already deleted');
  }

  // Soft delete
  const deletedChallenge = await prisma.challenge.update({
    where: { id },
    data: {
      isDeleted: true,
      isActive: false,
    },
  });

  return deletedChallenge;
};

const awardSeedPoints = async (
  challengeId: string,
  seederId: string,
  commentId: string,
  founderMail: string,
) => {
  const founder = await prisma.founder.findUnique({
    where: {
      email: founderMail,
    },
  });
  if (!founder) {
    throw new AppError(httpStatus.NOT_FOUND, 'Founder not found');
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId, status: ChallengeStatus.FINISHED },
    include: {
      founder: true,
    },
  });

  if (!challenge) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Challenge not found / or challenge status not Finished',
    );
  }

  if (challenge.isAwarded) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Challenge already awarded');
  }

  if (challenge.founderId !== founder.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only challenge owner can award points',
    );
  }

  const hasComment = await prisma.comment.findFirst({
    where: {
      challengeId,
      seederId,
    },
  });

  if (!hasComment) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Selected seeder has no comments on this challenge',
    );
  }

  const targetComment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      isWin: false,
    },
  });

  if (!targetComment) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'No eligible comment found for this seeder',
    );
  }

  const seeder = await prisma.seeder.findUnique({
    where: {
      id: seederId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      coin: true,
    },
  });

  //* seeder with active subscription add extra 25% coin
  const seederWithActiveSubscription = hasActiveSubscription(seeder);
  const basePoints = challenge.seedPoints;
  const awardedPoints = seederWithActiveSubscription
    ? Math.floor(basePoints * 1.25)
    : basePoints;

  const [updateChallenge, updatedComment, updateSeeder] =
    await prisma.$transaction([
      prisma.challenge.update({
        where: { id: challengeId },
        data: {
          isAwarded: true,
        },
        select: {
          id: true,
          title: true,
          seedPoints: true,
          isAwarded: true,
        },
      }),
      prisma.comment.update({
        where: { id: targetComment.id },
        data: { isWin: true },
        select: { id: true, content: true, isWin: true },
      }),
      prisma.seeder.update({
        where: {
          id: seederId,
        },
        data: {
          coin: { increment: awardedPoints },
        },
        select: {
          id: true,
          fullName: true,
          coin: true,
          level: true,
        },
      }),
    ]);

  return {
    message: `${updateSeeder.fullName} awarded ${challenge.seedPoints} SP for comment "${updatedComment.content.slice(0, 50)}..."! New coin: ${updateSeeder.coin}`,
    updateChallenge,
    updatedComment,
    updateSeeder,
  };

  // return null;
};

const updateChallengeStatus = async (
  challengeId: string,
  founderEmail: string,
) => {
  // console.log(founderEmail)
  const founder = await prisma.founder.findUnique({
    where: {
      email: founderEmail,
    },
  });
  if (!founder) {
    throw new AppError(httpStatus.NOT_FOUND, 'Founder not found');
  }
  const challenge = await prisma.challenge.findUnique({
    where: {
      id: challengeId,
    },
  });
  if (!challenge) {
    throw new AppError(httpStatus.NOT_FOUND, 'challenge not found');
  }

  const newStatus =
    challenge.status === ChallengeStatus.PENDING
      ? ChallengeStatus.FINISHED
      : ChallengeStatus.PENDING;

  const result = await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: newStatus },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
    },
  });

  return result;
};

export const ChallengeServices = {
  createIntoDb,
  getAllChallenge,
  getMyChallenge,
  getChallengeByIdFromDB,
  updateIntoDb,
  softDeleteIntoDb,
  awardSeedPoints,
  updateChallengeStatus,
  getAllAdminChallenge,
};
