import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errorHelpers/AppError';
import { uploadChatMediaToCloudinary } from '../../config/cloudinary.config';
import { emitChatEvent } from '../../socket/socket.helper';
import { getActiveLinkedUserAccessOrThrow } from '../candidate/linked-user/candidateLinkedUser.helper';
import { CandidateLinkedUserRelation } from '../candidate/linked-user/candidateLinkedUser.interface';
import {
  assertCanUseMessagingPlan,
  assertCandidateInConversation,
  assertLinkedUserCanReadConversation,
  assertLinkedUserCanSendMessage,
  assertValidObjectId,
  CHAT_MESSAGE_SELECT,
  CHAT_CANDIDATE_SELECT,
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
import {
  RishtaProgressStep,
  RishtaProgressStepSource,
} from '../rishta_progress/rishta_progress.interface';
import { RishtaProgressService } from '../rishta_progress/rishta_progress.service';
import { ChatMessageType, ISendMessagePayload } from './message.interface';
import Message from './message.model';
import {  encryptChatText } from '../../utils/chatEncryption';
import { buildMessageClientResponse, queueGenericChatNotifications } from './message.helper';

const MAX_CHAT_MEDIA_BYTES = 15 * 1024 * 1024;
const CHAT_SENT_BY_USER_SELECT = '_id full_name picture role';




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
    .populate({ path: 'sender', select: CHAT_CANDIDATE_SELECT })
    .populate({ path: 'sentBy', select: CHAT_SENT_BY_USER_SELECT })
    .populate({ path: 'seenBy', select: '_id full_name' })
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

  const messageResponse = buildMessageClientResponse(
    message,
    userId,
    access.relationshipToCandidate === CandidateLinkedUserRelation.SELF
      ? userId
      : undefined
  );

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
  sendMessage,
  uploadChatMedia,
};

