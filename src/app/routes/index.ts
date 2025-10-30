import express from 'express';
import { AuthRouters } from '../modules/Auth/Auth.routes';
import { UserRouters } from '../modules/User/user.routes';
import { PaymentRoutes } from '../modules/Payment/payment.route';
import { SubscriptionRoutes } from '../modules/Subscription/Subscription.routes';
import { SeederRoutes } from '../modules/Seeder/Seeder.routes';
import { ChallengeRoutes } from '../modules/Challenge/Challenge.routes';
import { CommentRoutes } from '../modules/Comment/Comment.routes';
import { ReactRoutes } from '../modules/React/React.routes';
import { MetaRoutes } from '../modules/Meta/Meta.routes';

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
  {
    path: '/challenge',
    route: ChallengeRoutes,
  },
  {
    path: '/comment',
    route: CommentRoutes,
  },
  {
    path: '/react',
    route: ReactRoutes,
  },
  {
    path: '/meta',
    route: MetaRoutes,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
