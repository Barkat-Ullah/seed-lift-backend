import express from 'express';
import { ChallengeController } from './Challenge.controller';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';
import { fileUploader } from '../../utils/fileUploader';

const router = express.Router();

router.get(
  '/',
  auth(UserRoleEnum.FOUNDER, UserRoleEnum.SEEDER),
  ChallengeController.getAllChallenge,
);
router.get(
  '/my',
  auth(UserRoleEnum.FOUNDER),
  ChallengeController.getMyChallenge,
);
router.get(
  '/:id',
  auth(UserRoleEnum.FOUNDER, UserRoleEnum.SEEDER),
  ChallengeController.getChallengeById,
);

router.post(
  '/',
  auth(UserRoleEnum.FOUNDER),
  fileUploader.uploadSingle,
  ChallengeController.createIntoDb,
);

router.post(
  '/:challengeId/awarded',
  auth(UserRoleEnum.FOUNDER),
  ChallengeController.awardedPoints,
);

router.put(
  '/update-status/:id',
  auth(UserRoleEnum.FOUNDER),
  ChallengeController.updateUserStatus,
);

router.patch(
  '/:id',
  auth(UserRoleEnum.FOUNDER),
  fileUploader.uploadSingle,
  ChallengeController.updateIntoDb,
);
router.delete(
  '/soft/:id',
  auth(UserRoleEnum.FOUNDER),
  ChallengeController.softDeleteIntoDb,
);

export const ChallengeRoutes = router;
