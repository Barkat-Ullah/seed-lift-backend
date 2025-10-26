import httpStatus from 'http-status';
import { Request } from 'express';
import { prisma } from '../../utils/prisma';
import { PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import { stripe } from '../../utils/stripe';
import Stripe from 'stripe';
import { toStringArray } from '../Auth/Auth.constant';
import { UserRoleEnum } from '@prisma/client';

// Create Subscription
const createIntoDb = async (req: Request) => {
  const adminId = req.user?.id;
  const { title, price, duration, feature } = req.body;

  if (!title || !price || !duration) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Missing required fields');
  }

  // Create product on Stripe
  const product = await stripe.products.create({
    name: title,
    description: `Subscription plan - ${duration}`,
    active: true,
  });

  const stripePrice = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(price * 100),
    currency: 'usd',
    recurring: {
      interval: duration === 'MONTHLY' ? 'month' : 'year',
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      title,
      price: parseFloat(price),
      duration,
      feature: toStringArray(feature),
      stripePriceId: stripePrice.id,
      stripeProductId: product.id,
      adminId,
    },
  });

  return subscription;
};

// Get All Subscription (Optional Filtering)
const getAllSubscription = async () => {
  const subscriptions = await prisma.subscription.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      price: true,
      duration: true,
      feature: true,
      stripePriceId: true,
      isActive: true,
    },
  });

  return subscriptions;
};

const assignSubscriptionToUser = async (userEmail: string, payload: any) => {
  const { subscriptionId, methodId } = payload;

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      founder: true,
      seeder: true,
    },
  });
  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found');

  const profile =
    user.role === UserRoleEnum.FOUNDER ? user.founder : user.seeder;
  if (!profile)
    throw new AppError(httpStatus.NOT_FOUND, `${user.role} profile not found`);

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!subscription)
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');

  if (profile.subscriptionEnd && profile.subscriptionEnd > new Date()) {
    throw new AppError(
      httpStatus.CONFLICT,
      'User already has an active subscription',
    );
  }

  if (!subscription.stripePriceId) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Stripe Price ID missing.',
    );
  }

  try {
    // 1️⃣ Ensure Stripe Customer Exists
    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile.fullName,
        metadata: { userId: user.id, role: user.role },
      });
      customerId = customer.id;
      const updateProfile =
        user.role === UserRoleEnum.FOUNDER
          ? prisma.founder.update({
              where: { email: userEmail },
              data: { stripeCustomerId: customerId },
            })
          : prisma.seeder.update({
              where: { email: userEmail },
              data: { stripeCustomerId: customerId },
            });
      await updateProfile;
    }

    // 2️⃣ Attach Payment Method
    await stripe.paymentMethods.attach(methodId, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: methodId },
    });

    // 3️⃣ Create Subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: subscription.stripePriceId }],
      expand: ['latest_invoice.payment_intent'],
    });

    console.log('✅ Stripe Subscription:', stripeSubscription.id);

    const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice?.payment_intent as Stripe.PaymentIntent;

    // 4️⃣ Store Payment Record (initially pending)
    const paymentData: any = {
      subscription: { connect: { id: subscription.id } },
      amount: subscription.price,
      currency: 'usd',
      status: PaymentStatus.PENDING,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: customerId,
      stripePaymentId: paymentIntent?.id,
    };

    if (user.role === UserRoleEnum.FOUNDER) {
      paymentData.founder = { connect: { id: profile.id } };
    } else {
      paymentData.seeder = { connect: { id: profile.id } };
    }

    const paymentRecord = await prisma.payment.create({
      data: paymentData,
    });

    // 5️⃣ Save Subscription Dates (provisional)
    const startDate = new Date();
    const endDate = new Date();
    if (subscription.duration === 'MONTHLY')
      endDate.setMonth(startDate.getMonth() + 1);
    if (subscription.duration === 'YEARLY')
      endDate.setFullYear(startDate.getFullYear() + 1);

    const updateProfileSub =
      user.role === UserRoleEnum.FOUNDER
        ? prisma.founder.update({
            where: { email: userEmail },
            data: {
              subscriptionId: subscription.id,
              subscriptionStart: startDate,
              subscriptionEnd: endDate,
            },
          })
        : prisma.seeder.update({
            where: { email: userEmail },
            data: {
              subscriptionId: subscription.id,
              subscriptionStart: startDate,
              subscriptionEnd: endDate,
            },
          });
    await updateProfileSub;

    return {
      message: 'Subscription initiated successfully',
      stripeSubscriptionId: stripeSubscription.id,
      clientSecret: paymentIntent?.client_secret || null,
      paymentId: paymentRecord.id,
    };
  } catch (error) {
    console.log('❌ Stripe Subscription Error:', error);
    throw error;
  }
};

const getUserSubscription = async (userEmail: string) => {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      founder: true,
      seeder: true,
    },
  });

  if (!user) return null;

  const profile =
    user.role === UserRoleEnum.FOUNDER ? user.founder : user.seeder;
  if (!profile || !profile.subscriptionId) return null;

  // Fetch latest payment using profile.id
  const latestPayment = await prisma.payment.findFirst({
    where: {
      OR: [{ founderId: profile.id }, { seederId: profile.id }],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!latestPayment || latestPayment.status !== PaymentStatus.SUCCESS) {
    throw new AppError(httpStatus.NOT_FOUND, 'Payment not successful');
  }

  const now = new Date();
  const remainingDays = profile.subscriptionEnd
    ? Math.max(
        Math.ceil(
          (profile.subscriptionEnd.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
        0,
      )
    : 0;

  if (remainingDays === 0) {
    const resetProfile =
      user.role === UserRoleEnum.FOUNDER
        ? prisma.founder.update({
            where: { email: userEmail },
            data: {
              subscriptionId: null,
              subscriptionStart: null,
              subscriptionEnd: null,
            },
          })
        : prisma.seeder.update({
            where: { email: userEmail },
            data: {
              subscriptionId: null,
              subscriptionStart: null,
              subscriptionEnd: null,
            },
          });
    await resetProfile;

    return {
      message: 'Subscription expired. Data reset successfully.',
    };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: profile.subscriptionId },
  });

  return {
    id: subscription?.id,
    title: subscription?.title,
    duration: subscription?.duration,
    feature: subscription?.feature,
    startDate: profile.subscriptionStart,
    endDate: profile.subscriptionEnd,
    remainingDays,
    owner: profile?.fullName,
  };
};

// Get Subscription by ID
const getSubscriptionByIdFromDB = async (id: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      price: true,
      duration: true,
      feature: true,
      stripePriceId: true,
      isActive: true,
    },
  });

  if (!subscription) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
  }

  return subscription;
};

// Update Subscription
const updateIntoDb = async (id: string, data: Partial<any>) => {
  // normalize price
  const price =
    data.price !== undefined && data.price !== null
      ? typeof data.price === 'string'
        ? parseFloat(data.price)
        : Number(data.price)
      : undefined;

  // normalize feature using toStringArray
  const featureArray =
    data.feature !== undefined ? toStringArray(data.feature) : undefined;

  const updateData: any = {
    ...(data.title && { title: data.title }),
    ...(price !== undefined && !Number.isNaN(price) && { price }),
    ...(data.duration && { duration: data.duration }),
  };

  // For arrays in Prisma (Mongo), use set for replace
  if (featureArray !== undefined) {
    updateData.feature = featureArray;
  }

  const subscription = await prisma.subscription.update({
    where: { id },
    data: updateData,
  });

  return subscription;
};

//
const deleteIntoDb = async (id: string) => {
  const subscription = await prisma.subscription.update({
    where: { id },
    data: { isActive: false },
  });

  return subscription;
};

const deleteMySubscription = async (userEmail: string) => {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      founder: true,
      seeder: true,
    },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const profile =
    user.role === UserRoleEnum.FOUNDER ? user.founder : user.seeder;
  if (!profile) {
    throw new AppError(httpStatus.NOT_FOUND, `${user.role} profile not found`);
  }

  if (!profile.subscriptionId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You do not have an active subscription to delete',
    );
  }

  const updateProfile =
    user.role === UserRoleEnum.FOUNDER
      ? prisma.founder.update({
          where: { email: userEmail },
          data: {
            subscriptionId: null,
            subscriptionStart: null,
            subscriptionEnd: null,
          },
        })
      : prisma.seeder.update({
          where: { email: userEmail },
          data: {
            subscriptionId: null,
            subscriptionStart: null,
            subscriptionEnd: null,
          },
        });

  await updateProfile;

  return { message: 'Subscription deleted successfully' };
};

export const SubscriptionServices = {
  createIntoDb,
  assignSubscriptionToUser,
  getAllSubscription,
  getSubscriptionByIdFromDB,
  updateIntoDb,
  deleteIntoDb,
  getUserSubscription,
  deleteMySubscription,
};
