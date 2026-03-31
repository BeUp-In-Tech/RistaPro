import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { Role } from '../user/user.interface';
import { PlanController } from './plan.controller';
import {
  createPlanZodSchema,
  updatePlanZodSchema,
} from './plan.validate';

const router = Router();

// PUBLIC ROUTES
router.get('/', PlanController.getPlans);
router.get('/:planType', PlanController.getPlan);

// ADMIN ROUTES
router.post(
  '/',
  checkAuth(Role.ADMIN),
  validateRequest(createPlanZodSchema),
  PlanController.createPlan
);
router.patch(
  '/:planType',
  checkAuth(Role.ADMIN),
  validateRequest(updatePlanZodSchema),
  PlanController.updatePlan
);

export const planRoutes = router;
