
import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { Role } from '../user/user.interface';
import { VisitorController } from './visitor.controller';

const router = Router();

router.post('/track', checkAuth(Role.USER), VisitorController.trackProfileVisit);

router.get('/', checkAuth(Role.USER), VisitorController.getProfileVisitors);

export const visitorRoutes = router;
