// Comment.controller.ts
import catchAsync from '../../utils/catchAsync';
import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import { Request, Response } from 'express';
import { CommentServices } from './Comment.service';

const createComment = catchAsync(async (req: Request, res: Response) => {
  const result = await CommentServices.createComment(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Comment created successfully',
    data: result,
  });
});

const replyToComment = catchAsync(async (req: Request, res: Response) => {
  const { commentId } = req.params;
  const result = await CommentServices.replyToComment(commentId, req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Reply created successfully',
    data: result,
  });
});

const getCommentsByChallenge = catchAsync(
  async (req: Request, res: Response) => {
    const { challengeId } = req.params;
    const result = await CommentServices.getCommentsByChallenge(
      challengeId,
      req.query,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Comments retrieved successfully',
      meta: result.meta,
      data: result.data,
    });
  },
);

const getCommentersByChallenge = catchAsync(
  async (req: Request, res: Response) => {
    const { challengeId } = req.params;
    const result = await CommentServices.getCommentersByChallenge(challengeId);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Commenters retrieved successfully',
      data: result,
    });
  },
);

const getCommentById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CommentServices.getCommentById(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comment retrieved successfully',
    data: result,
  });
});

const updateComment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CommentServices.updateComment(id, req.body, req.user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comment updated successfully',
    data: result,
  });
});

const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CommentServices.deleteComment(id, req.user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Comment deleted successfully',
    data: result,
  });
});

export const CommentController = {
  createComment,
  replyToComment,
  getCommentsByChallenge,
  getCommentersByChallenge,
  getCommentById,
  updateComment,
  deleteComment,
};
