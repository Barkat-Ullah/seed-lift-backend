import {
  ChallengeStatus,
  ChallengeType,
  LevelEnum,
  Prisma,
} from '@prisma/client';
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
  const { searchTerm, level, page = 1, limit = 15 } = query;

  const currentSeeder = await prisma.seeder.findUnique({
    where: { email: userMail },
    select: {
      id: true,
      fullName: true,
      profile: true,
      level: true,
      coin: true,
      subscriptionStart: true,
      subscriptionEnd: true,
    },
  });

  // Filtering conditions
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
    whereConditions.push({ level });
  }

  // Get all seeders
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
      subscriptionStart: true,
      subscriptionEnd: true,
      createdAt: true,
    },
  });

  // ✅ Add totalWin for each seeder
  const seedersWithWin = await Promise.all(
    seeders.map(async seeder => {
      const totalWin = await prisma.comment.count({
        where: {
          seederId: seeder.id,
          isWin: true,
          challenge: { isAwarded: true },
        },
      });

      return { ...seeder, totalWin };
    }),
  );

  // ✅ Add ranking metadata
  const seedersWithRanking = seedersWithWin.map(seeder => {
    const hasSubscription = hasActiveSubscription(seeder);
    const levelPriority =
      LEVEL_CONFIG[seeder.level as keyof typeof LEVEL_CONFIG]?.priority || 5;

    return {
      ...seeder,
      hasActiveSubscription: hasSubscription,
      levelPriority,
      sortKey: hasSubscription ? 0 : 1,
    };
  });

  // ✅ Sort seeders
  seedersWithRanking.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    if (a.levelPriority !== b.levelPriority)
      return a.levelPriority - b.levelPriority;
    return (b.coin || 0) - (a.coin || 0);
  });

  // ✅ Add rank
  const rankedSeeders = seedersWithRanking.map((seeder, index) => ({
    ...seeder,
    rank: index + 1,
    levelInfo: LEVEL_CONFIG[seeder.level as keyof typeof LEVEL_CONFIG],
  }));

  const skip = (Number(page) - 1) * Number(limit);
  const paginatedSeeders = rankedSeeders.slice(skip, skip + Number(limit));

  // ✅ Current seeder with progress
  let currentSeederWithProgress = null;
  if (currentSeeder) {
    const levelProgress = calculateLevelProgress(
      currentSeeder.level,
      currentSeeder.coin || 0,
    );

    currentSeederWithProgress = {
      ...currentSeeder,
      rank: rankedSeeders.findIndex(s => s.id === currentSeeder.id) + 1,
      hasActiveSubscription: hasActiveSubscription(currentSeeder),
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
      isPro: true,
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

  if (!seeder) {
    throw new Error('Seeder not found');
  }

  const hasSubscription = hasActiveSubscription(seeder);
  // const coins = seeder.coin || 0;
  const currentLevel = seeder.level;
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

  const rank = rankedSeeders.findIndex(s => s.id === id) + 1;

  let founderReplyCount = 0;
  try {
    founderReplyCount = await prisma.comment.count({
      where: {
        parent: {
          seederId: seeder.id,
        },
        isFounderReply: true,
      },
    });
   
  } catch (error) {
    console.error('Error fetching founder reply count:', error);
    founderReplyCount = 0;
   
  }

  return {
    ...seeder,
    hasActiveSubscription: hasSubscription,
    levelInfo,
    ranking: {
      currentRank: rank,
      totalSeeders: allSeeders.length,
    },
    totalWins: seeder.comment?.length || 0,
    totalReplies: founderReplyCount,
    successRate:
      seeder._count.comment > 0
        ? Math.round((seeder?.comment?.length / seeder?._count?.comment) * 100)
        : 0,
  };
};

// const getMySeederChallenges = async (seederMail: string) => {
//   const seeder = await prisma.seeder.findUnique({
//     where: { email: seederMail },
//     select: {
//       id: true,
//       fullName: true,
//       description: true,
//       email: true,
//       profile: true,
//       phoneNumber: true,
//       skill: true,
//       isPro: true,
//       level: true,
//       coin: true,
//       subscriptionStart: true,
//       subscriptionEnd: true,
//       subscription: { select: { id: true } },
//       comment: {
//         where: {
//           isWin: true,
//           challenge: { isAwarded: true },
//         },
//         select: { id: true },
//         orderBy: { updatedAt: 'desc' },
//         take: 10,
//       },
//       _count: {
//         select: { comment: true },
//       },
//     },
//   });

//   if (!seeder) {
//     throw new Error('Seeder not found');
//   }

//   const hasSubscription = hasActiveSubscription(seeder);
//   const currentLevel = seeder.level;
//   const levelInfo = LEVEL_CONFIG[currentLevel as keyof typeof LEVEL_CONFIG];

//   const allSeeders = await prisma.seeder.findMany({
//     select: {
//       id: true,
//       level: true,
//       coin: true,
//       subscriptionStart: true,
//       subscriptionEnd: true,
//     },
//   });

//   const rankedSeeders = allSeeders
//     .map(s => ({
//       ...s,
//       hasSubscription: hasActiveSubscription(s),
//       levelPriority:
//         LEVEL_CONFIG[s.level as keyof typeof LEVEL_CONFIG]?.priority || 5,
//     }))
//     .sort((a, b) => {
//       if (a.hasSubscription !== b.hasSubscription) {
//         return a.hasSubscription ? -1 : 1;
//       }
//       if (a.levelPriority !== b.levelPriority) {
//         return a.levelPriority - b.levelPriority;
//       }
//       return (b.coin || 0) - (a.coin || 0);
//     });

//   const rank = rankedSeeders.findIndex(s => s.id === seeder.id) + 1;

//   const founderReplyCount = await prisma.comment.count({
//     where: {
//       parent: {
//         seederId: seeder?.id,
//       },
//       isFounderReply: true,
//     },
//   });

//   return {
//     ...seeder,
//     hasActiveSubscription: hasSubscription,
//     levelInfo,
//     ranking: {
//       currentRank: rank,
//       totalSeeders: allSeeders.length,
//     },
//     founderReplyCount,
//     totalWins: seeder.comment.length,
//     totalReplies: seeder._count.comment,
//     successRate:
//       seeder._count.comment > 0
//         ? Math.round((seeder.comment.length / seeder._count.comment) * 100)
//         : 0,
//   };
// };

const getMySeederChallenges = async (seederMail: string) => {
  const seeder = await prisma.seeder.findUnique({
    where: { email: seederMail },
  });

  if (!seeder) {
    throw new Error('Seeder not found');
  }

  // 🧩 Seeder invited challenges
  const challenge = await prisma.challenge.findMany({
    where: {
      challengeType: 'Private',
      inviteTalents: {
        hasSome: [seeder.id],
      },
      isDeleted: false,
      isActive: true,
      status: 'PENDING',
    },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      tags: true,
      seedPoints: true,
      deadline: true,
      status: true,
      challengeType: true,
      _count: {
        select: {
          react: true,
          comment: true,
        },
      },
      founder: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // 💬 Seeder commented challenges
  const myCommentedChallenges = await prisma.comment.findMany({
    where: {
      seederId: seeder.id,
      challenge: {
        status: 'PENDING',
      },
    },
    select: {
      id: true,
      challenge: {
        select: {
          id: true,
          title: true,
          description: true,
          tags: true,
          status: true,
          category: true,
          seedPoints: true,
          deadline: true,
          founder: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          _count: {
            select: {
              react: true,
              comment: true,
            },
          },
        },
      },
    },
  });

  // 🧠 Step 1: make two arrays
  const invited = challenge.map(ch => ({
    ...ch,
    type: 'invited',
  }));

  const commented = myCommentedChallenges.map(c => ({
    ...c.challenge,
    type: 'commented',
  }));

  // ⚙️ Step 2: merge intelligently (commented will override invited)
  const map = new Map();

  // first add invited challenges
  for (const ch of invited) {
    map.set(ch.id, ch);
  }

  // then overwrite if same challenge commented
  for (const ch of commented) {
    map.set(ch.id, ch);
  }

  const finalChallenges = Array.from(map.values());

  return {
    data: finalChallenges,
  };
};

const myRewards = async (seederMail: string) => {
  const seeder = await prisma.seeder.findUnique({
    where: {
      email: seederMail,
    },
  });

  if (!seeder) {
    throw new Error('Seeder not found');
  }

  const rewardCommentsWithSeeder = await prisma.comment.findMany({
    where: {
      seederId: seeder.id,
      isWin: true,
      challenge: {
        isAwarded: true,
      },
    },
    select: {
      id: true,
      challenge: {
        select: {
          id: true,
          title: true,
          description: true,
          tags: true,
          category: true,
          seedPoints: true,
          isAwarded: true,
          status: true,
          _count: {
            select: {
              react: true,
              comment: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  const challenge = await prisma.challenge.count();
  const activeChallenge = await prisma.challenge.count({
    where: { isActive: true },
  });

  return {
    totalChallenge: challenge,
    activeChallenge: activeChallenge,
    rewards: rewardCommentsWithSeeder,
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
  myRewards,
  getMySeederChallenges,
};
