import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { Role } from '../user/user.interface';
import { SwipeController } from './swipe.controller';

const router = Router();

// TINDER-STYLE FEED: viewer can load recommendations
router.get('/feed', checkAuth(Role.USER), SwipeController.getSwipeFeed);

export const swipeRoutes = router;
