import catchAsync from "../../utils/catchAsync";
import httpStatus from "http-status";
import sendResponse from "../../utils/sendResponse";
import { Request, Response } from "express";
import { MetaServices } from "./Meta.service";

const getAllMetaForAdmin = catchAsync(async (req: Request, res: Response) => {

  const { period } = req.query;
  const result = await MetaServices.getAdminMeta(req.user?.email, period as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Successfully retrieved Admin Meta',
    data: result,
  });
});



export const MetaController = {
  getAllMetaForAdmin,
};
