import { Router } from 'express';
import { userRoutes } from '../modules/user/user.routes';
import { authRouter } from '../modules/auth/auth.routes';



export const router = Router();

const moduleRoutes = [
   {
    path: '/user',
    route: userRoutes
   },
   {
    path: '/auth',
    route: authRouter
   }
];

moduleRoutes.forEach((r) => {
  router.use(r.path, r.route);
});
