// Comment.routes.ts
import express from 'express';
import { CommentController } from './Comment.controller';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';
import { fileUploader } from '../../utils/fileUploader';

const router = express.Router();

// Get all comments for a specific challenge
router.get('/challenge/:challengeId', CommentController.getCommentsByChallenge);

// Get all commenters (seeders) for a specific challenge
router.get(
  '/challenge/:challengeId/commenters',
  CommentController.getCommentersByChallenge,
);

// Get comment by ID with replies
router.get('/:id', CommentController.getCommentById);

// Create a comment (Seeder only)
router.post(
  '/',
  auth(UserRoleEnum.SEEDER),
  fileUploader.uploadSingle,
  CommentController.createComment,
);

// Reply to a comment (Founder only)
router.post(
  '/:commentId/reply',
  auth(UserRoleEnum.FOUNDER),
  fileUploader.uploadSingle,
  CommentController.replyToComment,
);

// Update comment
router.patch(
  '/:id',
  auth(UserRoleEnum.SEEDER, UserRoleEnum.FOUNDER),
  CommentController.updateComment,
);

// Delete comment
router.delete(
  '/:id',
  auth(UserRoleEnum.SEEDER, UserRoleEnum.FOUNDER),
  CommentController.deleteComment,
);

export const CommentRoutes = router;
