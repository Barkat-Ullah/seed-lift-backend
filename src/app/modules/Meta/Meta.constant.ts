import AppError from "../../errors/AppError";
import httpStatus from 'http-status';

export const getDateRange = (period: string, offset: number = 0)=> {
  const now = new Date();
  now.setHours(0, 0, 0, 0); 

  let start: Date, end: Date;

  switch (period.toLowerCase()) {
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0); 
      break;
    case 'yearly':
      const year = now.getFullYear() - offset;
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
      break;
    default:
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Invalid period: monthly or yearly',
      );
  }

  end.setHours(23, 59, 59, 999);

  return { start, end };
};
