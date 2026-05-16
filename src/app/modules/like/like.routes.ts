import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { Role } from '../user/user.interface';
import { LikeController } from './like.controller';

const router = Router();

// AUTHENTICATED LINKED USER SEE WHO LIKED THIS CANDIDATE
router.get(
  '/received',
  checkAuth(Role.USER, Role.ADMIN),
  LikeController.getReceivedLikes
);

// AUTHENTICATED LINKED USER SEE WHO THIS CANDIDATE LIKED
router.get(
  '/sent',
  checkAuth(Role.USER, Role.ADMIN),
  LikeController.getSentLikes
);

export const likeRoutes = router;
