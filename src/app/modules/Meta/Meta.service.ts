import { prisma } from '../../utils/prisma';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { getDateRange } from './Meta.constant';

const getAdminMeta = async (adminMail: string, period: string = 'monthly') => {
  // console.log(period)
  const admin = await prisma.admin.findUnique({
    where: { email: adminMail },
  });
  if (!admin) {
    throw new AppError(httpStatus.NOT_FOUND, 'Admin not found');
  }

  if (typeof period !== 'string') {
    throw new AppError(httpStatus.BAD_REQUEST, 'Period must be a string');
  }

  const { start: periodStart, end: periodEnd } = getDateRange(period);

  const dateWhere = {
    createdAt: {
      gte: periodStart,
      lte: periodEnd,
    },
  };

  const totalChallenges = await prisma.challenge.count({
    where: dateWhere,
  });

  const totalFounders = await prisma.founder.count({
    where: {
      user: {
        isDeleted: false,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    },
  });

  const totalSeeders = await prisma.seeder.count({
    where: {
      user: {
        isDeleted: false,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    },
  });

  const totalRevenue = await prisma.payment
    .aggregate({
      where: dateWhere,
      _sum: { amount: true },
    })
    .then(agg => agg._sum.amount || 0);

  const topFounders = await prisma.founder.findMany({
    where: {
      user: { isDeleted: false },
      challenge: {
        some: {
          isAwarded: true,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
    orderBy: {
      challenge: {
        _count: 'desc',
      },
    },
    take: 3,
  });

  const topFoundersWithCounts = await Promise.all(
    topFounders.map(async founder => {
      const awardedCount = await prisma.challenge.count({
        where: {
          founderId: founder.id,
          isAwarded: true,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      });
      return {
        ...founder,
        count: awardedCount, 
      };
    }),
  );

  const topSeeders = await prisma.seeder.findMany({
    where: {
      user: { isDeleted: false },
      comment: {
        some: {
          isWin: true,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
    orderBy: {
      comment: {
        _count: 'desc',
      },
    },
    take: 2,
  });


  const topSeedersWithCounts = await Promise.all(
    topSeeders.map(async seeder => {
      const winCount = await prisma.comment.count({
        where: {
          seederId: seeder.id,
          isWin: true,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      });
      return {
        ...seeder,
        count: winCount, 
      };
    }),
  );

  return {
    totalRevenue,
    totalFounders,
    totalSeeders,
    totalChallenges,
    topFounders: topFoundersWithCounts,
    topSeeders: topSeedersWithCounts,
  };
};

export const MetaServices = {
  getAdminMeta,
};
