export const LEVEL_CONFIG = {
  Sprout: { minCoins: 0, maxCoins: 4999, priority: 4 }, 
  Grower: { minCoins: 5000, maxCoins: 9999, priority: 3 },
  Cultivator: { minCoins: 10000, maxCoins: 19999, priority: 2 },
  Harvester: { minCoins: 20000, maxCoins: 29999, priority: 1 }, 
  Master: { minCoins: 30000, maxCoins: Infinity, priority: 0 }, 
};

export const getLevelByCoins = (coins: number) => {
  if (coins >= 30000) return 'Master';
  if (coins >= 20000) return 'Harvester';
  if (coins >= 10000) return 'Cultivator';
  if (coins >= 5000) return 'Grower';
  return 'Sprout';
};

export const hasActiveSubscription = (seeder: any) => {
  if (!seeder.subscriptionStart || !seeder.subscriptionEnd) return false;
  const now = new Date();
  return now >= seeder.subscriptionStart && now <= seeder.subscriptionEnd;
};

export const calculateLevelProgress = (currentLevel: string, coins: number) => {
  let nextLevel = null;
  let progressPercentage = 0;
  let coinsToNextLevel = 0;

  if (currentLevel === 'Sprout') {
    nextLevel = 'Grower';
    coinsToNextLevel = 5000 - coins; 
    progressPercentage = (coins / 5000) * 100;
  } else if (currentLevel === 'Grower') {
    nextLevel = 'Cultivator';
    coinsToNextLevel = 10000 - coins;
    progressPercentage = ((coins - 5000) / 5000) * 100; 
  } else if (currentLevel === 'Cultivator') {
    nextLevel = 'Harvester';
    coinsToNextLevel = 20000 - coins; 
    progressPercentage = ((coins - 10000) / 10000) * 100; 
  } else if (currentLevel === 'Harvester') {
    nextLevel = 'Master';
    coinsToNextLevel = 30000 - coins; 
    progressPercentage = ((coins - 20000) / 10000) * 100; 
  } else if (currentLevel === 'Master') {
    nextLevel = null;
    progressPercentage = 100;
    coinsToNextLevel = 0;
  }

  return {
    currentLevel,
    nextLevel,
    currentCoins: coins,
    coinsToNextLevel: Math.max(0, coinsToNextLevel),
    progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
  };
};
