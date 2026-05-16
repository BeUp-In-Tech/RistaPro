import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { Role } from '../user/user.interface';
import { SwipeController } from './swipe.controller';
import { swipeActionZodSchema } from './swipe.validate';

const router = Router();

// NEARBY DISCOVERY: viewer can load preference-matching profiles around current location
router.get(
  '/nearby-matches',
  checkAuth(Role.USER),
  SwipeController.getNearbyMatches
);

// TINDER-STYLE FEED: viewer can load recommendations
router.get('/feed', checkAuth(Role.USER), SwipeController.getSwipeFeed);

// TINDER-STYLE ACTION: owner/editor can like, super-like, or pass a profile
router.post(
  '/action',
  checkAuth(Role.USER),
  validateRequest(swipeActionZodSchema),
  SwipeController.performSwipeAction
);

export const swipeRoutes = router;
