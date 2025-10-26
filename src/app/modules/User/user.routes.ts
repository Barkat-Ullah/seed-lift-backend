import express from 'express';
import auth from '../../middlewares/auth';
import { UserControllers } from './user.controller';
import { UserRoleEnum } from '@prisma/client';
import { upload } from '../../utils/fileUploader';

const router = express.Router();

router.get('/', UserControllers.getAllUsers);
router.get(
  '/me',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.FOUNDER, UserRoleEnum.SEEDER),
  UserControllers.getMyProfile,
);

router.get('/:id', auth('ANY'), UserControllers.getUserDetails);

router.delete('/soft-delete', auth('ANY'), UserControllers.softDeleteUser);
router.delete(
  '/hard-delete/:id',
  auth(UserRoleEnum.ADMIN),
  UserControllers.hardDeleteUser,
);

router.put(
  '/user-status/:id',
  auth(UserRoleEnum.ADMIN),
  UserControllers.updateUserStatus,
);

router.put(
  '/update-profile',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.FOUNDER, UserRoleEnum.SEEDER),
  upload.fields([{ name: 'profile', maxCount: 1 }]),
  UserControllers.updateMyProfile,
);

export const UserRouters = router;
