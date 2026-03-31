import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { planRoutes } from '../modules/plan/plan.routes';
export const router = Router();

const moduleRoutes =[
    {
    path: '/auth',
    route: authRouter,
  },
  {
    path: '/plans',
    route: planRoutes,
  },
];


moduleRoutes.forEach((r) => {
  router.use(r.path, r.route);
});
