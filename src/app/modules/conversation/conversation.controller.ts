
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';
import { CatchAsync } from '../../utils/CatchAsync';
import { SendResponse } from '../../utils/SendResponse';
import {
  conversationMessagesQueryZodSchema,
  guardianRequestListQueryZodSchema,
} from './conversation.validate';
import { ConversationService } from './conversation.service';
import { conversationMessageRequestListQueryZodSchema } from '../conversation-message-request/conversationMessageRequest.validate';

// AUTH LINKED USER STARTS/RETURNS THE CHAT FOR AN ACTIVE MATCH
const startMatchConversation = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const candidateId =
      typeof req.query.candidateId === 'string'
        ? req.query.candidateId
        : undefined;
    const result = await ConversationService.startMatchConversation(
      String(userId),
      String(req.params.matchId),
      candidateId
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Conversation started successfully',
      data: result,
    });
  }
);

// AUTH LINKED USER LISTS CANDIDATE CONVERSATIONS
const getConversations = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const query = req.query as Record<string, string>;
  const result = await ConversationService.getConversations(
    String(userId),
    query 
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Conversations retrieved successfully',
    data: result,
  });
});

// AUTH LINKED USER LOADS MESSAGE HISTORY
const getConversationMessages = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const query = await conversationMessagesQueryZodSchema.parseAsync(req.query);
    const result = await ConversationService.getConversationMessages(
      String(userId),
      String(req.params.conversationId),
      query
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Conversation messages retrieved successfully',
      data: result,
    });
  }
);

// AUTH LINKED USER MARKS A CHAT AS READ
const markConversationRead = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await ConversationService.markConversationRead(
      String(userId),
      String(req.params.conversationId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Conversation marked as read',
      data: result,
    });
  }
);

// AUTH OWNER/EDITOR SENDS A MESSAGE REQUEST
const createMessageRequest = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await ConversationService.createMessageRequest(
      String(userId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.CREATED,
      message: 'Message request sent successfully',
      data: result,
    });
  }
);

// AUTH LINKED USER LISTS MESSAGE REQUESTS
const getMessageRequests = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const query = await conversationMessageRequestListQueryZodSchema.parseAsync(
    req.query
  );
  const result = await ConversationService.getMessageRequests(
    String(userId),
    query
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Message requests retrieved successfully',
    data: result,
  });
});

// AUTH OWNER/EDITOR ACCEPTS A MESSAGE REQUEST
const acceptMessageRequest = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await ConversationService.acceptMessageRequest(
      String(userId),
      String(req.params.requestId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Message request accepted successfully',
      data: result,
    });
  }
);

// AUTH OWNER/EDITOR REJECTS A MESSAGE REQUEST
const rejectMessageRequest = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await ConversationService.rejectMessageRequest(
      String(userId),
      String(req.params.requestId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Message request rejected successfully',
      data: result,
    });
  }
);

// AUTH OWNER/EDITOR ASKS OPPONENT TO INCLUDE ONE GUARDIAN/PARENT
const createGuardianRequest = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await ConversationService.createGuardianRequest(
      String(userId),
      String(req.params.conversationId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.CREATED,
      message: 'Guardian request sent successfully',
      data: result,
    });
  }
);

// AUTH LINKED USER LISTS GUARDIAN REQUESTS
const getGuardianRequests = CatchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user as JwtPayload;
  const query = await guardianRequestListQueryZodSchema.parseAsync(req.query);
  const result = await ConversationService.getGuardianRequests(
    String(userId),
    query
  );

  SendResponse(res, {
    success: true,
    statusCode: StatusCodes.OK,
    message: 'Guardian requests retrieved successfully',
    data: result,
  });
});

// AUTH OWNER/EDITOR ACCEPTS GUARDIAN/PARENT INCLUSION
const acceptGuardianRequest = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await ConversationService.acceptGuardianRequest(
      String(userId),
      String(req.params.requestId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Guardian request accepted successfully',
      data: result,
    });
  }
);

// AUTH OWNER/EDITOR REJECTS GUARDIAN/PARENT INCLUSION
const rejectGuardianRequest = CatchAsync(
  async (req: Request, res: Response) => {
    const { userId } = req.user as JwtPayload;
    const result = await ConversationService.rejectGuardianRequest(
      String(userId),
      String(req.params.requestId),
      req.body
    );

    SendResponse(res, {
      success: true,
      statusCode: StatusCodes.OK,
      message: 'Guardian request rejected successfully',
      data: result,
    });
  }
);

export const ConversationController = {
  acceptGuardianRequest,
  acceptMessageRequest,
  createGuardianRequest,
  createMessageRequest,
  getConversationMessages,
  getConversations,
  getGuardianRequests,
  getMessageRequests,
  markConversationRead,
  rejectGuardianRequest,
  rejectMessageRequest,
  startMatchConversation,
};
