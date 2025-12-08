import AppError from '../../errors/AppError';
import { prisma } from '../../utils/prisma';
import httpStatus from 'http-status';

const createReactIntoDb = async (seederMail: string, challengeId: string) => {
  const seeder = await prisma.seeder.findUnique({
    where: { email: seederMail },
  });

  if (!seeder) {
    throw new AppError(httpStatus.NOT_FOUND, 'Seeder not found');
  }

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new AppError(httpStatus.NOT_FOUND, 'Challenge not found');
  }

  const founderId = challenge.founderId;
  const seederId = seeder.id;

  const existingReact = await prisma.react.findUnique({
    where: {
      founderId_seederId_challengeId: {
        founderId,
        seederId,
        challengeId,
      },
    },
  });

  if (existingReact) {
    const newIsReact = !existingReact.isReact;
    const result = await prisma.react.update({
      where: { id: existingReact.id },
      data: {
        isReact: newIsReact,
      },
      select: {
        id: true,
        isReact: true,
      },
    });
    return result;
  }

  const result = await prisma.react.create({
    data: {
      founderId,
      seederId,
      challengeId,
      isReact: true,
    },
    select: {
      id: true,
      isReact: true,
    },
  });

  return result;
};

const getAllReactIntoDb = async (challengeId: string) => {
  const reacts = await prisma.react.findMany({
    where: { challengeId },
    select: {
      id: true,
      seederId: true,
    },
  });

  const totalReact = await prisma.react.count({ where: { challengeId } });
  return { reacts, totalReact };
};

export const ReactServices = {
  createReactIntoDb,
  getAllReactIntoDb,
};
