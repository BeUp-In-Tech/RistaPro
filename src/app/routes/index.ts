import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
export const router = Router();

const moduleRoutes =[
    {
    path: '/auth',
    route: authRouter,
  },
];


moduleRoutes.forEach((r) => {
  router.use(r.path, r.route);
});

