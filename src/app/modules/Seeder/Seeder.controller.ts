import catchAsync from '../../utils/catchAsync';
import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import { Request, Response } from 'express';
import { SeederServices } from './Seeder.service';

const getAllSeeder = catchAsync(async (req: Request, res: Response) => {
  const result = await SeederServices.getAllSeeder(req.query, req.user?.email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved all Seeder',
    data: result,
  });
});

const getSeederById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SeederServices.getSeederByIdFromDB(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved Seeder by id',
    data: result,
  });
});

const getMyRewards = catchAsync(async (req: Request, res: Response) => {
  const result = await SeederServices.myRewards(req.user?.email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved my rewards',
    data: result,
  });
});

const getMySeederProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await SeederServices.getMySeederChallenges(req.user?.email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved my seed challenge',
    data: result,
  });
});

export const SeederController = {
  getAllSeeder,
  getSeederById,
  getMyRewards,
  getMySeederProfile,
};
