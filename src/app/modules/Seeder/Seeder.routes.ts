import express from 'express';
import { SeederController } from './Seeder.controller';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.get(
  '/',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SEEDER, UserRoleEnum.FOUNDER),
  SeederController.getAllSeeder,
);
router.get(
  '/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SEEDER, UserRoleEnum.FOUNDER),
  SeederController.getSeederById,
);

export const SeederRoutes = router;
