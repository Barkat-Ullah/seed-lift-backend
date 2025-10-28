import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import {
  calculateLevelProgress,
  getLevelByCoins,
  hasActiveSubscription,
  LEVEL_CONFIG,
} from './Seeder.helper';

// Get All Seeders with Ranking
// ============================================
const getAllSeeder = async (query: Record<string, any>, userMail: string) => {
  const { searchTerm, level, page = 1, limit = 10 } = query;

  const currentSeeder = await prisma.seeder.findUnique({
    where: {
      email: userMail,
    },
    select: {
      id: true,
      fullName: true,
      profile: true,
      level: true,
      coin: true,
      // subscriptionStart: true,
      // subscriptionEnd: true,
    },
  });

  // Filter conditions
  const whereConditions: Prisma.SeederWhereInput[] = [];

  if (searchTerm) {
    whereConditions.push({
      OR: [
        { fullName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (level) {
    whereConditions.push({
      level: level,
    });
  }

  // all seeders
  const seeders = await prisma.seeder.findMany({
    where: whereConditions.length > 0 ? { AND: whereConditions } : {},
    select: {
      id: true,
      fullName: true,
      profile: true,
      level: true,
      coin: true,
      email: true,
      skill: true,
      // subscriptionStart: true,
      // subscriptionEnd: true,
      createdAt: true,
    },
    take: 15,
  });

  // add Ranking metadata
  const seedersWithRanking = seeders.map(seeder => {
    // const hasSubscription = hasActiveSubscription(seeder);
    const levelPriority =
      LEVEL_CONFIG[seeder.level as keyof typeof LEVEL_CONFIG]?.priority || 5;

    return {
      ...seeder,
      // hasActiveSubscription: hasSubscription,
      levelPriority,
      // sortKey: hasSubscription ? 0 : 1,
    };
  });

  // Ranking sort
  seedersWithRanking.sort((a, b) => {
    // if (a.sortKey !== b.sortKey) {
    //   return a.sortKey - b.sortKey;
    // }

    if (a.levelPriority !== b.levelPriority) {
      return a.levelPriority - b.levelPriority;
    }

    return (b.coin || 0) - (a.coin || 0);
  });

  const rankedSeeders = seedersWithRanking.map((seeder, index) => ({
    ...seeder,
    rank: index + 1,
    levelInfo: LEVEL_CONFIG[seeder.level as keyof typeof LEVEL_CONFIG],
  }));

  const skip = (Number(page) - 1) * Number(limit);
  const paginatedSeeders = rankedSeeders.slice(skip, skip + Number(limit));

  let currentSeederWithProgress = null;
  if (currentSeeder) {
    const levelProgress = calculateLevelProgress(
      currentSeeder.level,
      currentSeeder.coin || 0,
    );

    currentSeederWithProgress = {
      ...currentSeeder,
      // hasActiveSubscription: hasActiveSubscription(currentSeeder),
      rank: rankedSeeders.findIndex(s => s.id === currentSeeder.id) + 1,
      levelProgress,
      levelInfo: LEVEL_CONFIG[currentSeeder.level as keyof typeof LEVEL_CONFIG],
    };
  }

  return {
    currentSeeder: currentSeederWithProgress,
    seeders: paginatedSeeders,
    pagination: {
      total: rankedSeeders.length,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(rankedSeeders.length / Number(limit)),
    },
  };
};

// Get Single Seeder by ID
// ============================================
const getSeederByIdFromDB = async (id: string) => {
  const seeder = await prisma.seeder.findUnique({
    where: {
      id: id,
    },
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
      // subscriptionStart: true,
      // subscriptionEnd: true,
      // subscription: { select: { id: true } },
      // challenge: {
      //   select: {
      //     title: true,
      //     tags: true,
      //     category: true,
      //     seedPoints: true,
      //   },
      //   orderBy: {
      //     createdAt: 'desc',
      //   },
      //   take: 10,
      // },
    },
  });

  if (!seeder) {
    throw new Error('Seeder not found');
  }

  // const hasSubscription = hasActiveSubscription(seeder);
  // const coins = seeder.coin || 0;
  const currentLevel = seeder.level;
  const levelInfo = LEVEL_CONFIG[currentLevel as keyof typeof LEVEL_CONFIG];

  const allSeeders = await prisma.seeder.findMany({
    select: {
      id: true,
      level: true,
      coin: true,
      // subscriptionStart: true,
      // subscriptionEnd: true,
    },
  });

  const rankedSeeders = allSeeders
    .map(s => ({
      ...s,
      // hasSubscription: hasActiveSubscription(s),
      levelPriority:
        LEVEL_CONFIG[s.level as keyof typeof LEVEL_CONFIG]?.priority || 5,
    }))
    .sort((a, b) => {
      // if (a.hasSubscription !== b.hasSubscription) {
      //   return a.hasSubscription ? -1 : 1;
      // }
      if (a.levelPriority !== b.levelPriority) {
        return a.levelPriority - b.levelPriority;
      }
      return (b.coin || 0) - (a.coin || 0);
    });

  const rank = rankedSeeders.findIndex(s => s.id === id) + 1;

  return {
    ...seeder,
    // hasActiveSubscription: hasSubscription,
    levelInfo,
    ranking: {
      currentRank: rank,
      totalSeeders: allSeeders.length,
    },
  };
};

// Update Seeder Level
// ============================================
const updateSeederLevel = async (seederId: string) => {
  const seeder = await prisma.seeder.findUnique({
    where: { id: seederId },
    select: { coin: true },
  });

  if (!seeder) {
    throw new Error('Seeder not found');
  }

  const newLevel = getLevelByCoins(seeder.coin || 0);

  const updatedSeeder = await prisma.seeder.update({
    where: { id: seederId },
    data: { level: newLevel as any },
  });

  return updatedSeeder;
};

export const SeederServices = {
  getAllSeeder,
  getSeederByIdFromDB,
  updateSeederLevel,
};
