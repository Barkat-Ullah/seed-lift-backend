import { Request } from 'express';
import { prisma } from '../../utils/prisma';
import { uploadToDigitalOceanAWS } from '../../utils/uploadToDigitalOceanAWS';
import { ChallengeStatus, ChallengeCategory } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createIntoDb = async (req: Request) => {
  const {
    inviteTalents,
    status,
    deadline,
    seedPoints,
    tags,
    category,
    description,
    title,
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
    const location = await uploadToDigitalOceanAWS(req.file);
    attachmentUrl = location.Location;
  }

  // Parse inviteTalents and tags if they're strings
  const parsedInviteTalents =
    typeof inviteTalents === 'string'
      ? JSON.parse(inviteTalents)
      : inviteTalents || [];

  const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags || [];

  // Create challenge
  const challenge = await prisma.challenge.create({
    data: {
      title,
      description,
      category: category as ChallengeCategory,
      attachment: attachmentUrl,
      tags: parsedTags,
      seedPoints: parseInt(seedPoints),
      deadline: new Date(deadline),
      status: (status as ChallengeStatus) || ChallengeStatus.PENDING,
      inviteTalents: parsedInviteTalents,
      founderId: founder.id,
    },
  });
  console.log(challenge);
  return challenge;
};

const getAllChallenge = async (query: Record<string, any>) => {
  const {
    searchTerm,
    category,
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

  // Build where clause
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

  // Fetch challenges and count
  const [challenges, total] = await Promise.all([
    prisma.challenge.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        title: true,
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
        founder: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    }),
    prisma.challenge.count({ where }),
    // prisma.react.count(),
    // prisma.comment.count(),
  ]);

  const now = new Date();

  const updatedChallenges = await Promise.all(
    challenges.map(async challenge => {
      let remainingDays = 0;

      if (challenge.deadline) {
        const diffMs = new Date(challenge.deadline).getTime() - now.getTime();
        remainingDays = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 0);
      }

      if (remainingDays === 0 && challenge.isActive) {
        await prisma.challenge.update({
          where: { id: challenge.id },
          data: { isActive: false, status: ChallengeStatus.FINISHED },
        });
      }

      return {
        ...challenge,
        remainingDays,
      };
    }),
  );

  return {
    data: updatedChallenges,
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

  const where: any = {
    founderId: founder?.id,
    isDeleted: false,
    status: { in: [ChallengeStatus.PENDING, ChallengeStatus.FINISHED] },
  };

  if (status) {
    where.status = status;
  }

  if (!founder) {
    throw new AppError(httpStatus.NOT_FOUND, 'Founder not found');
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
        select: {
          seeder: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return challenges;
};

const getChallengeByIdFromDB = async (id: string) => {
  const challenge = await prisma.challenge.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
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
    throw new AppError(httpStatus.NOT_FOUND, 'Challenge not found');
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

  const [updateChallenge, updateSeeder] = await prisma.$transaction([
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
    prisma.seeder.update({
      where: {
        id: seederId,
      },
      data: {
        coin: { increment: challenge.seedPoints },
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
    message: `${updateSeeder.fullName} awarded ${challenge.seedPoints} SP! New coin balance: ${updateSeeder.coin}`,
    updateChallenge,
    updateSeeder,
  };
};

export const ChallengeServices = {
  createIntoDb,
  getAllChallenge,
  getMyChallenge,
  getChallengeByIdFromDB,
  updateIntoDb,
  softDeleteIntoDb,
  awardSeedPoints,
};
