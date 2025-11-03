import { Request } from 'express';
import { uploadToDigitalOceanAWS } from '../../utils/uploadToDigitalOceanAWS';
import { prisma } from '../../utils/prisma';
import { BannerType } from '@prisma/client';

const createIntoDb = async (req: Request) => {
  const file = req.file as Express.Multer.File | undefined;
  const adminId = req.user.id;
  const { title, type } = JSON.parse(req.body.data);

  if (!file) {
    throw new Error('Banner image is required');
  }

  const uploaded = await uploadToDigitalOceanAWS(file);
  const iconUrl = uploaded.Location;

  const result = await prisma.banner.create({
    data: {
      adminId,
      title,
      type: type as BannerType,
      image: iconUrl,
    },
  });

  return result;
};

const getAllBanner = async (query: Record<string, any>) => {
  const { type } = query;
  const where: any = {};
  if (type) where.type = type;
  const banners = await prisma.banner.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      image: true,
      type: true,
      title: true,
    },
  });
  return banners;
};

const getBannerByIdFromDB = async (id: string) => {
  const banner = await prisma.banner.findUnique({
    where: { id },
    select: {
      id: true,
      image: true,
    },
  });

  if (!banner) {
    throw new Error('Banner not found');
  }

  return banner;
};

const deleteIntoDb = async (id: string) => {
  const deleted = await prisma.banner.delete({
    where: { id },
  });

  return deleted;
};

export const BannerServices = {
  createIntoDb,
  getAllBanner,
  getBannerByIdFromDB,
  deleteIntoDb,
};
