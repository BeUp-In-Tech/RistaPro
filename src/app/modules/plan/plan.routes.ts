import { Router } from 'express';
import { PlanController } from './plan.controller';

const router = Router();

router.get('/', PlanController.getPlans);
router.get('/:key', PlanController.getPlan);

export const planRoutes = router;
