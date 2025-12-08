// Comment.service.ts
import { Request } from 'express';
import { prisma } from '../../utils/prisma';
import { uploadToDigitalOceanAWS } from '../../utils/uploadToDigitalOceanAWS';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { createNotification } from '../../constant/notify';

const createComment = async (req: Request) => {
  const { content, challengeId } = req.body;
  const seederEmail = req.user.email;

  // Find seeder
  const seeder = await prisma.seeder.findUnique({
    where: { email: seederEmail },
  });

  if (!seeder) {
    throw new AppError(httpStatus.NOT_FOUND, 'Seeder not found');
  }

  // Check if challenge exists
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new AppError(httpStatus.NOT_FOUND, 'Challenge not found');
  }

  if (challenge.isDeleted) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cannot comment on deleted challenge',
    );
  }

  // Handle image upload
  // let imageUrl = null;
  // if (req.file) {
  //   const location = await uploadToDigitalOceanAWS(req.file);
  //   imageUrl = location.Location;
  // }

  // Create comment
  const comment = await prisma.comment.create({
    data: {
      content,
      // image: imageUrl,
      seederId: seeder.id,
      challengeId,
      isFounderReply: false,
      parentId: null,
    },
    include: {
      seeder: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profile: true,
          level: true,
        },
      },
    },
  });

  await createNotification({
    receiverId: challenge.founderId,
    senderId: seeder.id,
    title: 'A New Comment Added Now',
    body: `${seeder.fullName || 'A Seeder'} commented on your challenge: ${challenge.title }`,
  });

  return comment;
};

const replyToComment = async (commentId: string, req: Request) => {
  const { content } = req.body;
  const founderEmail = req.user.email;

  // Find founder
  const founder = await prisma.founder.findUnique({
    where: { email: founderEmail },
  });

  if (!founder) {
    throw new AppError(httpStatus.NOT_FOUND, 'Founder not found');
  }

  // Check if parent comment exists
  const parentComment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      challenge: true,
    },
  });

  if (!parentComment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Verify founder owns the challenge
  if (parentComment.challenge?.founderId !== founder.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only reply to comments on your own challenges',
    );
  }

  // Handle image upload
  // let imageUrl = null;
  // if (req.file) {
  //   const location = await uploadToDigitalOceanAWS(req.file);
  //   imageUrl = location.Location;
  // }

  // Create reply
  const reply = await prisma.comment.create({
    data: {
      content,
      // image: imageUrl,
      founderId: founder.id,
      challengeId: parentComment.challengeId,
      parentId: commentId,
      isFounderReply: true,
    },
    include: {
      founder: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profile: true,
        },
      },
      challenge: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  return reply;
};

const getCommentsByChallenge = async (
  challengeId: string,
  query: Record<string, any>,
) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'asc',
  } = query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Check if challenge exists
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });
  // console.log('challenge', challenge);

  if (!challenge) {
    throw new AppError(httpStatus.NOT_FOUND, 'Challenge not found');
  }

  // Get top-level comments with their replies
  const [comments, totalComments] = await Promise.all([
    prisma.comment.findMany({
      where: {
        challengeId,
        parentId: null,
      },
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        content: true,
        // image: true,
        seederId: true,
        founderId: true,
        challengeId: true,
        parentId: true,
        isFounderReply: true,
        isWin: true,
        seeder: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profile: true,
            level: true,
            coin: true,
          },
        },
        replies: {
          select: {
            id: true,
            content: true,
            // image: true,
            seederId: true,
            founderId: true,
            challengeId: true,
            parentId: true,
            isFounderReply: true,
            founder: {
              select: {
                id: true,
                fullName: true,
                email: true,
                profile: true,
              },
            },
            seeder: {
              select: {
                id: true,
                fullName: true,
                email: true,
                profile: true,
                level: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    }),
    prisma.comment.count({
      where: { challengeId },
    }),
  ]);

  return {
    data: comments,
    meta: {
      page: parseInt(page),
      limit: parseInt(limit),
      commentsCount: totalComments,
      totalPages: Math.ceil(totalComments / parseInt(limit)),
    },
  };
};

const getCommentersByChallenge = async (challengeId: string) => {
  // Check if challenge exists
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      founder: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  if (!challenge) {
    throw new AppError(httpStatus.NOT_FOUND, 'Challenge not found');
  }

  // Get unique seeders who commented on this challenge
  const commenters = await prisma.comment.findMany({
    where: { challengeId },
    select: {
      seeder: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profile: true,
          level: true,
          coin: true,
          comment: {
            where: {
              challengeId,
            },
            select: {
              id: true,
              content: true,
              isWin: true,
              challengeId: true,
            },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      },
    },
    distinct: ['seederId'],
  });

  const uniqueCommenters = commenters
    .map(commenter => commenter.seeder)
    .filter(seeder => seeder !== null);

  return {
    totalCommenters: uniqueCommenters.length,
    challenge: {
      id: challenge.id,
      Awarded: challenge.isAwarded,
      seedPoints: challenge.seedPoints,
      founder: challenge.founder,
      status: challenge.status,
    },
    commenters: uniqueCommenters,
  };
};

const getCommentById = async (id: string) => {
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: {
      seeder: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profile: true,
          level: true,
        },
      },
      replies: {
        include: {
          seeder: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profile: true,
              level: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      challenge: {
        select: {
          id: true,
          title: true,
          founderId: true,
        },
      },
    },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  return comment;
};

const updateComment = async (id: string, data: Partial<any>, user: any) => {
  // Find comment
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: {
      seeder: true,
    },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Check if user owns the comment
  if (comment.seeder?.email !== user.email) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only update your own comments',
    );
  }

  // Update comment
  const updateData: any = {};
  if (data.content) updateData.content = data.content;
  // if (data.image) updateData.image = data.image;

  const updatedComment = await prisma.comment.update({
    where: { id },
    data: updateData,
    include: {
      seeder: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profile: true,
          level: true,
        },
      },
    },
  });

  return updatedComment;
};

const deleteComment = async (id: string, user: any) => {
  // Find comment
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: {
      seeder: true,
      challenge: {
        include: {
          founder: true,
        },
      },
    },
  });

  if (!comment) {
    throw new AppError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  // Check if user owns the comment or owns the challenge
  const isOwner = comment?.seeder?.email === user.email;
  const isChallengeOwner = comment.challenge?.founder.email === user.email;

  if (!isOwner && !isChallengeOwner) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only delete your own comments or comments on your challenges',
    );
  }

  // Delete comment and all its replies
  await prisma.comment.delete({
    where: { id },
  });

  return { message: 'Comment deleted successfully' };
};

export const CommentServices = {
  createComment,
  replyToComment,
  getCommentsByChallenge,
  getCommentersByChallenge,
  getCommentById,
  updateComment,
  deleteComment,
};
