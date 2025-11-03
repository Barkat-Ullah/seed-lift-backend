import { ChallengeStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export const updateChallengesWithRemainingDays = async (
  challenges: any[],
  now: Date,
) => {
  return await Promise.all(
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
};
