
import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { Role } from '../user/user.interface';
import { MessageController } from './message.controller';
import { sendMessageZodSchema } from './message.validate';

const router = Router();

// SEND TEXT MESSAGE INTO AN OPEN CONVERSATION
router.post(
  '/',
  checkAuth(Role.USER),
  validateRequest(sendMessageZodSchema),
  MessageController.sendMessage
);

export const messageRoutes = router;
