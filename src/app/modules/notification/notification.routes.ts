import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { Role } from '../user/user.interface';
import { NotificationController } from './notification.controller';

const router = Router();

router.get(
  '/',
  checkAuth(...Object.values(Role)),
  NotificationController.getMyNotifications
);

router.patch(
  '/:id/seen',
  checkAuth(...Object.values(Role)),
  NotificationController.markNotificationSeen
);

export const notificationRoutes = router;
