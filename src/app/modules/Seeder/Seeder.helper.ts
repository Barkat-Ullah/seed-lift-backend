//  Level thresholds and priorities
export const LEVEL_CONFIG = {
  Starter: { minCoins: 0, maxCoins: 5000, priority: 4 },
  Intermediate: { minCoins: 5000, maxCoins: 10000, priority: 3 },
  Gold: { minCoins: 10000, maxCoins: 35000, priority: 2 },
  Pro: { minCoins: 35000, maxCoins: Infinity, priority: 1 },
};

//  Helper function to get level based on coins
export const getLevelByCoins = (coins: number) => {
  if (coins >= 35000) return 'Pro';
  if (coins >= 10000) return 'Gold';
  if (coins >= 5000) return 'Intermediate';
  return 'Starter';
};

//  Helper function to check if subscription is active
export const hasActiveSubscription = (seeder: any) => {
  if (!seeder.subscriptionStart || !seeder.subscriptionEnd) return false;
  const now = new Date();
  return now >= seeder.subscriptionStart && now <= seeder.subscriptionEnd;
};

// Helper to calculate progress toward next level
export const calculateLevelProgress = (currentLevel: string, coins: number) => {
  let nextLevel = null;
  let progressPercentage = 0;
  let coinsToNextLevel = 0;

  if (currentLevel === 'Starter') {
    nextLevel = 'Intermediate';
    coinsToNextLevel = 5000 - coins;
    progressPercentage = (coins / 5000) * 100;
  } else if (currentLevel === 'Intermediate') {
    nextLevel = 'Gold';
    coinsToNextLevel = 10000 - coins;
    progressPercentage = ((coins - 5000) / 5000) * 100;
  } else if (currentLevel === 'Gold') {
    nextLevel = 'Pro';
    coinsToNextLevel = 35000 - coins;
    progressPercentage = ((coins - 10000) / 25000) * 100;
  } else if (currentLevel === 'Pro') {
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
