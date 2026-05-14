
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errorHelpers/AppError';
import { emitChatEvent } from '../../socket/socket';
import { getActiveLinkedUserAccessOrThrow } from '../candidate/linked-user/candidateLinkedUser.helper';
import {
  assertCanUseMessagingPlan,
  assertCandidateInConversation,
  assertLinkedUserCanSendMessage,
  assertValidObjectId,
  getCandidatePlanOrDefault,
  getConversationAudienceUserIds,
  getConversationByIdOrThrow,
} from '../conversation/conversation.helper';
import { ConversationStatus } from '../conversation/conversation.interface';
import Conversation from '../conversation/conversation.model';
import { ISendMessagePayload, MessageType } from './message.interface';
import Message from './message.model';

// POST /messages - sends one text message into an open conversation.
const sendMessage = async (userId: string, payload: ISendMessagePayload) => {
  assertValidObjectId(payload.conversationId, 'conversation id');
  assertValidObjectId(payload.candidateId, 'candidate id');

  if (payload.replyTo) {
    assertValidObjectId(payload.replyTo, 'reply message id');
  }

  const conversation = await getConversationByIdOrThrow(payload.conversationId);

  if (conversation.status !== ConversationStatus.OPEN) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Messages can only be sent in an open conversation'
    );
  }

  assertCandidateInConversation(conversation, payload.candidateId);

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: payload.candidateId,
    userId,
  });

  assertLinkedUserCanSendMessage({
    access,
    guardianParticipants: conversation.guardianParticipants,
  });

  const plan = await getCandidatePlanOrDefault(payload.candidateId);
  assertCanUseMessagingPlan(plan);

  if (payload.replyTo) {
    const replyMessageExists = await Message.exists({
      _id: payload.replyTo,
      conversation: payload.conversationId,
    });

    if (!replyMessageExists) {
      throw new AppError(
        StatusCodes.NOT_FOUND,
        'Reply message was not found in this conversation'
      );
    }
  }

  const messageDoc = await Message.create({
    conversation: new Types.ObjectId(payload.conversationId),
    message: payload.message.trim(),
    replyTo: payload.replyTo ? new Types.ObjectId(payload.replyTo) : undefined,
    seenBy: [new Types.ObjectId(userId)],
    sender: new Types.ObjectId(payload.candidateId),
    sentBy: new Types.ObjectId(userId),
    sentByLinkedUser: access._id,
    type: MessageType.TEXT,
  });

  const message = await Message.findById(messageDoc._id).lean();

  if (!message) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Message was saved but could not be loaded'
    );
  }

  const audienceUserIds = await getConversationAudienceUserIds(conversation);
  const unreadIncrements = audienceUserIds
    .filter((audienceUserId) => audienceUserId !== userId)
    .reduce<Record<string, number>>((fields, audienceUserId) => {
      fields[`unreadCounts.${audienceUserId}`] = 1;
      return fields;
    }, {});

  await Conversation.findByIdAndUpdate(payload.conversationId, {
    $inc: unreadIncrements,
    $set: {
      lastMessage: messageDoc._id,
      [`unreadCounts.${userId}`]: 0,
    },
  });

  emitChatEvent({
    conversationId: payload.conversationId,
    event: 'message:new',
    payload: {
      conversationId: payload.conversationId,
      message,
    },
    userIds: audienceUserIds,
  });

  return message;
};

export const MessageService = {
  sendMessage,
};
