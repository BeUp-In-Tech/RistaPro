
import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { Role } from '../user/user.interface';
import { ConversationController } from './conversation.controller';
import {
  createGuardianRequestZodSchema,
  markConversationReadZodSchema,
  respondGuardianRequestZodSchema,
} from './conversation.validate';
import {
  createConversationMessageRequestZodSchema,
  respondConversationMessageRequestZodSchema,
} from '../conversation-message-request/conversationMessageRequest.validate';

const router = Router();

// MESSAGE REQUEST FLOW
router.post(
  '/message_requests',
  checkAuth(Role.USER),
  validateRequest(createConversationMessageRequestZodSchema),
  ConversationController.createMessageRequest
);
router.get(
  '/message_requests',
  checkAuth(Role.USER),
  ConversationController.getMessageRequests
);
router.patch(
  '/message-requests/:requestId/accept',
  checkAuth(Role.USER),
  validateRequest(respondConversationMessageRequestZodSchema),
  ConversationController.acceptMessageRequest
);
router.patch(
  '/message-requests/:requestId/reject',
  checkAuth(Role.USER),
  validateRequest(respondConversationMessageRequestZodSchema),
  ConversationController.rejectMessageRequest
);

// GUARDIAN/PARENT INCLUDE REQUEST FLOW
router.get(
  '/guardian-requests',
  checkAuth(Role.USER),
  ConversationController.getGuardianRequests
);
router.patch(
  '/guardian-requests/:requestId/accept',
  checkAuth(Role.USER),
  validateRequest(respondGuardianRequestZodSchema),
  ConversationController.acceptGuardianRequest
);
router.patch(
  '/guardian-requests/:requestId/reject',
  checkAuth(Role.USER),
  validateRequest(respondGuardianRequestZodSchema),
  ConversationController.rejectGuardianRequest
);

// MATCH FLOW
router.post(
  '/matches/:matchId/start',
  checkAuth(Role.USER),
  ConversationController.startMatchConversation
);

// CONVERSATION LIST AND MESSAGE HISTORY
router.get('/', checkAuth(Role.USER), ConversationController.getConversations);
router.get(
  '/:conversationId/messages',
  checkAuth(Role.USER),
  ConversationController.getConversationMessages
);
router.patch(
  '/:conversationId/read',
  checkAuth(Role.USER),
  validateRequest(markConversationReadZodSchema),
  ConversationController.markConversationRead
);
router.post(
  '/:conversationId/guardian-requests',
  checkAuth(Role.USER),
  validateRequest(createGuardianRequestZodSchema),
  ConversationController.createGuardianRequest
);

export const conversationRoutes = router;
