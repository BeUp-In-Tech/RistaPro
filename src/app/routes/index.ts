import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { candidateRoutes } from '../modules/candidate/candidate.routes';
import { candidatePreferenceRoutes } from '../modules/candidate-preference/candidatePreference.routes';
import { matchRoutes } from '../modules/match/match.routes';
import { conversationRoutes } from '../modules/conversation/conversation.routes';
import { messageRoutes } from '../modules/message/message.routes';
import { planRoutes } from '../modules/plan/plan.routes';
import { swipeRoutes } from '../modules/swipe/swipe.routes';
import { likeRoutes } from '../modules/like/like.routes';
import { userRoutes } from '../modules/user/user.routes';
import { documentRoutes } from '../modules/document/document.routes';
import { rishtaProgressRoutes } from '../modules/rishta_progress/rishta_progress.routes';
import { notificationRoutes } from '../modules/notification/notification.routes';
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
    path: '/likes',
    route: likeRoutes,
  },
  {
    path: '/matches',
    route: matchRoutes,
  },
  {
    path: '/conversations',
    route: conversationRoutes,
  },
  {
    path: '/messages',
    route: messageRoutes,
  },
  {
    path: '/users',
    route: userRoutes,
  },
  {
    path: '/documents',
    route: documentRoutes,
  },
  {
    path: '/notifications',
    route: notificationRoutes,
  },
  {
    path: '/rishta-progress',
    route: rishtaProgressRoutes,
  },
];

moduleRoutes.forEach((r) => {
  router.use(r.path, r.route);
});
