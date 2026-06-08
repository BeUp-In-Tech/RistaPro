
import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { chatMediaMulterUpload } from '../../config/multer.config';
import { Role } from '../user/user.interface';
import { MessageController } from './message.controller';
import { sendMessageZodSchema } from './message.validate';

const router = Router();

// SEND TEXT/IMAGE/IMAGE+CAPTION MESSAGE INTO AN OPEN CONVERSATION
router.post(
  '/',
  checkAuth(Role.USER),
  validateRequest(sendMessageZodSchema),
  MessageController.sendMessage
);

// UPLOAD CHAT IMAGE TO CLOUDINARY (returns attachment object for use in POST /)
router.post(
  '/:conversationId/media',
  checkAuth(Role.USER),
  chatMediaMulterUpload.single('file'),
  MessageController.uploadChatMedia
);

export const messageRoutes = router;
