import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import { ReactServices } from './React.service';

const createReact = catchAsync(async (req: Request, res: Response) => {
  const seederMail = req.user?.email;
  const { challengeId } = req.params;
  const result = await ReactServices.createReactIntoDb(seederMail, challengeId);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: result.isFavorite
      ? 'Added to favorites'
      : 'Removed from favorites',
    data: result,
  });
});
const getAllReacts = catchAsync(async (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const result = await ReactServices.getAllReactIntoDb(challengeId);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Fetched All react successfully',
    data: result,
  });
});

export const ReactController = { createReact, getAllReacts };
