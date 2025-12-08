import catchAsync from '../../utils/catchAsync';
import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import { Request, Response } from 'express';
import { FaqServices } from './Faq.service';

const createIntoDb = catchAsync(async (req: Request, res: Response) => {
  const result = await FaqServices.createIntoDb(req);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Successfully created About',
    data: result,
  });
});

const getAllFaq = catchAsync(async (req: Request, res: Response) => {
  const result = await FaqServices.getAllFaq(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved all About',
    data: result,
  });
});

const getMyFaq = catchAsync(async (req: Request, res: Response) => {
  const result = await FaqServices.getMyFaq(req.user.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved my About',
    data: result,
  });
});

const getFaqById = catchAsync(async (req: Request, res: Response) => {
  const result = await FaqServices.getFaqByIdFromDB(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved About',
    data: result,
  });
});

const updateIntoDb = catchAsync(async (req: Request, res: Response) => {
  const result = await FaqServices.updateIntoDb(req.params.id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully updated About',
    data: result,
  });
});

const deleteIntoDb = catchAsync(async (req: Request, res: Response) => {
  const result = await FaqServices.deleteIntoDb(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully deleted About',
    data: result,
  });
});

const softDeleteIntoDb = catchAsync(async (req: Request, res: Response) => {
  const result = await FaqServices.softDeleteIntoDb(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully soft deleted About',
    data: result,
  });
});

export const FaqController = {
  createIntoDb,
  getAllFaq,
  getMyFaq,
  getFaqById,
  updateIntoDb,
  deleteIntoDb,
  softDeleteIntoDb,
};
