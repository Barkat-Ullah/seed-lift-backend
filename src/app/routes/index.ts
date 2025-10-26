import express from 'express';
import { AuthRouters } from '../modules/Auth/Auth.routes';
import { UserRouters } from '../modules/User/user.routes';
import { PaymentRoutes } from '../modules/Payment/payment.route';
import { SubscriptionRoutes } from '../modules/Subscription/Subscription.routes';
import { SeederRoutes } from '../modules/Seeder/Seeder.routes';

const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRouters,
  },
  {
    path: '/user',
    route: UserRouters,
  },
  {
    path: '/payment',
    route: PaymentRoutes,
  },
  {
    path: '/subscription',
    route: SubscriptionRoutes,
  },
  {
    path: '/seeder',
    route: SeederRoutes,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
