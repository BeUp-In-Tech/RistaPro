import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errorHelpers/AppError';
import { uploadChatMediaToCloudinary } from '../../config/cloudinary.config';
import { emitChatEvent } from '../../socket/socket';
import { sendNotificationByBullMQ } from '../../utils/backgroundJobProcessingHelper';
import { getActiveLinkedUserAccessOrThrow } from '../candidate/linked-user/candidateLinkedUser.helper';
import {
  assertCanUseMessagingPlan,
  assertCandidateInConversation,
  assertLinkedUserCanReadConversation,
  assertLinkedUserCanSendMessage,
  assertValidObjectId,
  CHAT_MESSAGE_SELECT,
  getCandidatePlanOrDefault,
  getConversationAudienceUserIds,
  getConversationByIdOrThrow,
  isWritableLinkedUser,
} from '../conversation/conversation.helper';
import {
  ConversationStatus,
  IChatMediaMetadataPayload,
} from '../conversation/conversation.interface';
import Conversation from '../conversation/conversation.model';
import { NotificationType } from '../notification/notification.interface';
import {
  RishtaProgressStep,
  RishtaProgressStepSource,
} from '../rishta_progress/rishta_progress.interface';
import { RishtaProgressService } from '../rishta_progress/rishta_progress.service';
import { ChatMessageType, ISendMessagePayload } from './message.interface';
import Message from './message.model';
import { decryptChatText, encryptChatText } from '../../utils/chatEncryption';

const MAX_CHAT_MEDIA_BYTES = 15 * 1024 * 1024;

type TMessageForClient = Record<string, unknown> & {
  body?: unknown;
  type?: ChatMessageType;
};

export const buildMessageResponse = <T extends TMessageForClient>(message: T) => {
  const { body, ...rest } = message;
  const response: Record<string, unknown> = { ...rest };

  if (
    (message.type === ChatMessageType.TEXT ||
      message.type === ChatMessageType.IMAGE_TEXT) &&
    body
  ) {
    try {
      const plaintext = decryptChatText(
        body as Parameters<typeof decryptChatText>[0]
      );

      if (message.type === ChatMessageType.TEXT) {
        response.message = plaintext;
      } else {
        response.caption = plaintext;
      }
    } catch {
      response.messageUnavailable = true;
    }
  }

  return response;
};

const queueGenericChatNotifications = async (params: {
  senderUserId: string;
  audienceUserIds: string[];
  conversationId: string;
  messageId: string;
  type: ChatMessageType;
}) => {
  const recipients = params.audienceUserIds.filter(
    (audienceUserId) => audienceUserId !== params.senderUserId
  );

  const body =
    params.type === ChatMessageType.IMAGE ||
    params.type === ChatMessageType.IMAGE_TEXT
      ? 'You received a photo'
      : 'New message';

  await Promise.all(
    recipients.map((recipientUserId) =>
      sendNotificationByBullMQ(
        {
          user: recipientUserId,
          type: NotificationType.MESSAGE,
          title: 'New message',
          body,
          entityId: new Types.ObjectId(params.messageId),
          data: {
            conversationId: params.conversationId,
            messageId: params.messageId,
            messageType: params.type,
          },
        },
        `chat_message_${params.messageId}_${recipientUserId}`
      )
    )
  );
};

// POST /messages - sends one backend-encrypted message into an open conversation.
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

  const plaintext =
    payload.type === ChatMessageType.TEXT ? payload.message : payload.caption;

  const messageDoc = await Message.create({
    conversation: new Types.ObjectId(payload.conversationId),
    type: payload.type,
    body: plaintext ? encryptChatText(plaintext) : null,
    attachments: payload.attachments ?? [],
    replyTo: payload.replyTo ? new Types.ObjectId(payload.replyTo) : undefined,
    seenBy: [new Types.ObjectId(userId)],
    sender: new Types.ObjectId(payload.candidateId),
    sentBy: new Types.ObjectId(userId),
    sentByLinkedUser: access._id,
  });

  const message = await Message.findById(messageDoc._id)
    .select(CHAT_MESSAGE_SELECT)
    .lean();

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

  await RishtaProgressService.completeAutomaticStep({
    candidateIds: conversation.participants,
    completedBy: userId,
    conversationId: conversation._id,
    matchId: conversation.match,
    referenceId: messageDoc._id,
    source: RishtaProgressStepSource.MATCH_CHAT_STARTED,
    step: RishtaProgressStep.START_CHAT,
  });

  const messageResponse = buildMessageResponse(message);

  emitChatEvent({
    conversationId: payload.conversationId,
    event: 'message:new',
    payload: {
      conversationId: payload.conversationId,
      message: messageResponse,
    },
    userIds: audienceUserIds,
  });

  void queueGenericChatNotifications({
    senderUserId: userId,
    audienceUserIds,
    conversationId: payload.conversationId,
    messageId: messageDoc._id.toString(),
    type: payload.type,
  }).catch(() => undefined);

  return messageResponse;
};

// POST /messages/conversations/:conversationId/media - uploads a normal chat image.
async function uploadChatMedia(
  userId: string,
  conversationId: string,
  payload: IChatMediaMetadataPayload,
  file?: Express.Multer.File
) {
  assertValidObjectId(conversationId, 'conversation id');
  assertValidObjectId(payload.candidateId, 'candidate id');

  if (!file?.buffer?.length) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Chat media file is required');
  }

  if (file.size > MAX_CHAT_MEDIA_BYTES) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Chat media file must be at most 15MB'
    );
  }

  const conversation = await getConversationByIdOrThrow(conversationId);

  if (conversation.status !== ConversationStatus.OPEN) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Chat media can only be uploaded for an open conversation'
    );
  }

  assertCandidateInConversation(conversation, payload.candidateId);

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: payload.candidateId,
    userId,
  });

  if (!isWritableLinkedUser(access.accessRole)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Viewer access cannot upload chat media'
    );
  }

  assertLinkedUserCanReadConversation({
    access,
    guardianParticipants: conversation.guardianParticipants,
  });

  const plan = await getCandidatePlanOrDefault(payload.candidateId);
  assertCanUseMessagingPlan(plan);

  const uploadResult = await uploadChatMediaToCloudinary({
    buffer: file.buffer,
    conversationId,
  });

  return {
    provider: 'cloudinary',
    cloudinaryPublicId: uploadResult.public_id,
    imageUrl: uploadResult.secure_url,
    mimeType: file.mimetype,
    size: uploadResult.bytes ?? file.size,
    width: payload.width ?? null,
    height: payload.height ?? null,
  };
}


export const MessageService = {
  buildMessageResponse,
  sendMessage,
  uploadChatMedia,
};

