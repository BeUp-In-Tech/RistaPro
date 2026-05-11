import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { candidateRoutes } from '../modules/candidate/candidate.routes';
import { candidatePreferenceRoutes } from '../modules/candidate-preference/candidatePreference.routes';
import { matchRoutes } from '../modules/match/match.routes';
import { planRoutes } from '../modules/plan/plan.routes';
import { swipeRoutes } from '../modules/swipe/swipe.routes';
import { userRoutes } from '../modules/user/user.routes';
export const router = Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: authRouter,
  },
  {
    path: '/plans',
    route: planRoutes,
  },
  {
    path: '/candidates',
    route: candidateRoutes,
  },
  {
    path: '/candidate-preferences',
    route: candidatePreferenceRoutes,
  },
  {
    path: '/swipes',
    route: swipeRoutes,
  },
  {
    path: '/matches',
    route: matchRoutes,
  },
  {
    path: '/users',
    route: userRoutes,
  },
];

moduleRoutes.forEach((r) => {
  router.use(r.path, r.route);
});
