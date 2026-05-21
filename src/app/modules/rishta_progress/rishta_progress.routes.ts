import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { Role } from '../user/user.interface';
import { RishtaProgressController } from './rishta_progress.controller';
import {
  adminMarkMarriedZodSchema,
  createMarriageRequestZodSchema,
  respondMarriageRequestZodSchema,
} from './rishta_progress.validate';

const router = Router();

router.get(
  '/married',
  checkAuth(Role.ADMIN, Role.CONSULTANT),
  RishtaProgressController.getMarriedList
);

router.post(
  '/admin/married',
  checkAuth(Role.ADMIN),
  validateRequest(adminMarkMarriedZodSchema),
  RishtaProgressController.adminMarkMarried
);

router.post(
  '/marriage-requests',
  checkAuth(Role.USER, Role.CONSULTANT),
  validateRequest(createMarriageRequestZodSchema),
  RishtaProgressController.createMarriageRequest
);

router.get(
  '/marriage-requests',
  checkAuth(Role.USER),
  RishtaProgressController.getMarriageRequests
);

router.patch(
  '/marriage-requests/:requestId/accept',
  checkAuth(Role.USER),
  validateRequest(respondMarriageRequestZodSchema),
  RishtaProgressController.acceptMarriageRequest
);

router.patch(
  '/marriage-requests/:requestId/reject',
  checkAuth(Role.USER),
  validateRequest(respondMarriageRequestZodSchema),
  RishtaProgressController.rejectMarriageRequest
);

router.get('/', checkAuth(Role.USER), RishtaProgressController.getProgress);

export const rishtaProgressRoutes = router;
