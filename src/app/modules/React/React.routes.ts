import express from 'express';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';
import { ReactController } from './React.controller';

const router = express.Router();

router.get(
  '/:challengeId',
  auth(UserRoleEnum.SEEDER, UserRoleEnum.FOUNDER),
  ReactController.getAllReacts,
);
router.post(
  '/toggle/:challengeId',
  auth(UserRoleEnum.SEEDER),
  ReactController.createReact,
);

export const ReactRoutes = router;
