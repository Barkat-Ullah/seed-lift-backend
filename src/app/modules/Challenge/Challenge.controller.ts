import catchAsync from '../../utils/catchAsync';
import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import { Request, Response } from 'express';
import { ChallengeServices } from './Challenge.service';

const createIntoDb = catchAsync(async (req: Request, res: Response) => {
  const result = await ChallengeServices.createIntoDb(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Successfully created Challenge',
    data: result,
  });
});

const getAllChallenge = catchAsync(async (req: Request, res: Response) => {
  const seederMail = req.user?.email
  const result = await ChallengeServices.getAllChallenge(req.query,seederMail);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved all Challenge',
    meta: result.meta,
    data: result.data,
  });
});
const getAllChallengeForAdmin = catchAsync(
  async (req: Request, res: Response) => {

    const result = await ChallengeServices.getAllAdminChallenge(
      req.query,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Successfully retrieved all Challenges by admin',
      meta: result.meta,
      data: result.data,
    });
  },
);

const getMyChallenge = catchAsync(async (req: Request, res: Response) => {
  const result = await ChallengeServices.getMyChallenge(
    req.user?.email,
    req.query,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved my Challenge',
    data: result,
  });
});

const getChallengeById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ChallengeServices.getChallengeByIdFromDB(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved Challenge by id',
    data: result,
  });
});

const updateIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const payload = req.body?.data ? JSON.parse(req.body.data) : {};
  const file = req.file;
  const result = await ChallengeServices.updateIntoDb(id, payload, file);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully updated Challenge',
    data: result,
  });
});

const softDeleteIntoDb = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ChallengeServices.softDeleteIntoDb(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully soft deleted Challenge',
    data: result,
  });
});

const awardedPoints = catchAsync(async (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const { seederId, commentId } = req.body;
  const result = await ChallengeServices.awardSeedPoints(
    challengeId,
    seederId,
    commentId,
    req.user?.email,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message:
      result.message || 'Seed points awarded successfully to the winner!',
    data: result,
  });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const founderMail = req.user.email;
  // console.log(founderMail)
  const { id } = req.params;
  const result = await ChallengeServices.updateChallengeStatus(id, founderMail);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Challenge status updated successfully',
    data: result,
  });
});

export const ChallengeController = {
  createIntoDb,
  getAllChallenge,
  getMyChallenge,
  getChallengeById,
  updateIntoDb,
  softDeleteIntoDb,
  awardedPoints,
  updateUserStatus,
  getAllChallengeForAdmin,
};
