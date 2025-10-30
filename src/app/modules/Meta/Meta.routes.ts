import express from 'express';
import { MetaController } from './Meta.controller';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

router.get(
  '/admin',
  auth(UserRoleEnum.ADMIN),
  MetaController.getAllMetaForAdmin,
);

export const MetaRoutes = router;
