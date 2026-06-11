import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errorHelpers/AppError';
import { emitChatEvent } from '../../socket/socket';
import { getActiveLinkedUserAccessOrThrow } from '../candidate/linked-user/candidateLinkedUser.helper';
import {
  CandidateLinkedUserRelation,
  CandidateLinkedUserStatus,
  TActiveLinkedUserLean,
} from '../candidate/linked-user/candidateLinkedUser.interface';
import CandidateLinkedUser from '../candidate/linked-user/candidateLinkedUser.model';
import ConversationMessageRequest from '../conversation-message-request/conversationMessageRequest.model';
import {
  ConversationMessageRequestStatus,
  IConversationMessageRequest,
} from '../conversation-message-request/conversationMessageRequest.interface';
import {
  ensureMatchConversation,
  getMatchAccessOrThrow,
  getMatchByIdOrThrow,
} from '../match/match.helper';
import { MatchStatus } from '../match/match.interface';
import {
  assertCanUseMessagingPlan,
  assertCandidateInConversation,
  assertWritableConversationAccess,
  buildConversationResponse,
  assertLinkedUserCanReadConversation,
  assertValidObjectId,
  buildConversationPairKey,
  CHAT_CANDIDATE_SELECT,
  CHAT_MESSAGE_SELECT,
  findActiveGuardianParticipant,
  getActiveTargetCandidateOrThrow,
  getCandidateAudienceUserIds,
  getCandidatePlanOrDefault,
  getConversationAudienceUserIds,
  getConversationByIdOrThrow,
  getOtherConversationCandidateId,
  isGuardianRelation,
  isWritableLinkedUser,
} from './conversation.helper';
import {
  ConversationSource,
  ConversationStatus,
  IConversationMessagesQuery,
  ICreateGuardianRequestPayload,
  ICreateMessageRequestPayload,
  IGuardianRequestListQuery,
  IMessageRequestListQuery,
  IRespondRequestPayload,
  TConversationLean,
} from './conversation.interface';
import Conversation from './conversation.model';
import ConversationGuardianRequest from './conversationGuardianRequest.model';
import {
  ConversationGuardianRequestStatus,
  IConversationGuardianRequest,
} from './conversationGuardianRequest.interface';
import Message from '../message/message.model';
import { buildMessageResponse } from '../message/message.service';
import { ChatMessageType } from '../message/message.interface';
import { decryptChatText, encryptChatText } from '../../utils/chatEncryption';
import { RishtaProgressService } from '../rishta_progress/rishta_progress.service';
import {
  RishtaProgressStep,
  RishtaProgressStepSource,
} from '../rishta_progress/rishta_progress.interface';
import { QueryBuilder } from '../../utils/QueryBuilder';

const buildConversationClientResponse = (
  conversation: TConversationLean,
  userId: string
) => {
  const response = buildConversationResponse(conversation, userId);

  if (response.lastMessage && typeof response.lastMessage === 'object') {
    return {
      ...response,
      lastMessage: buildMessageResponse(
        response.lastMessage as unknown as Record<string, unknown>
      ),
    };
  }

  return response;
};

// POST /conversations/matches/:matchId/start - opens the chat for an active match.
const startMatchConversation = async (
  userId: string,
  matchId: string,
  candidateId?: string
) => {
  const match = await getMatchByIdOrThrow(matchId);
  await getMatchAccessOrThrow({ candidateId, match, userId });

  if (match.status !== MatchStatus.ACTIVE) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Only active matches can start conversations'
    );
  }

  const matchWithConversation = await ensureMatchConversation(match);
  const conversation = await Conversation.findById(
    matchWithConversation.conversation
  )
    .populate({ path: 'lastMessage', select: CHAT_MESSAGE_SELECT })
    .lean<TConversationLean | null>();

  if (!conversation) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Conversation not found');
  }

  await RishtaProgressService.completeAutomaticStep({
    candidateIds: match.candidates,
    completedBy: userId,
    conversationId: conversation._id,
    matchId: match._id,
    source: RishtaProgressStepSource.MATCH_CHAT_STARTED,
    step: RishtaProgressStep.START_CHAT,
  });

  emitChatEvent({
    conversationId: conversation._id.toString(),
    event: 'conversation:started',
    payload: { conversation: buildConversationClientResponse(conversation, userId) },
    userIds: await getConversationAudienceUserIds(conversation),
  });

  return buildConversationClientResponse(conversation, userId);
};

// GET /conversations - lists chats for one candidate profile.
const getConversations = async (userId: string, query: Record<string, string>) => {
  assertValidObjectId(query.candidateId, 'candidate id');

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: query.candidateId,
    userId,
  });

  const conversationQuery: Record<string, unknown> = {
    participants: new Types.ObjectId(query.candidateId),
    status: query.status ?? ConversationStatus.OPEN,
    ...(query.source && { source: query.source }),
  };

  // Guardians only see conversations after the opponent accepted the include request.
  if (isGuardianRelation(access.relationshipToCandidate) && !access.isPrimary) {
    conversationQuery.guardianParticipants = {
      $elemMatch: {
        candidate: new Types.ObjectId(query.candidateId),
        isActive: true,
        linkedUser: access._id,
        user: new Types.ObjectId(userId),
      },
    };
  }

  // If a name search is provided, pre-filter opponents by name then restrict
  // conversations to only those containing a matching participant.
  if (query.search?.trim()) {
    const Candidate = (await import('../candidate/candidate.model')).default;
    const matchingOpponents = await Candidate.find({
      _id: { $ne: new Types.ObjectId(query.candidateId) },
      name: { $regex: query.search.trim(), $options: 'i' },
    })
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>();

    const opponentIds = matchingOpponents.map((c) => c._id);

    // No matching candidates → return empty result immediately
    if (!opponentIds.length) {
      return { meta: { page: 1, limit: 20, total: 0, totalPage: 0 }, conversations: [] };
    }

    conversationQuery.participants = {
      $all: [new Types.ObjectId(query.candidateId)],
      $in: opponentIds,
    };
  }

  const baseQuery = Conversation.find(conversationQuery).sort({
    updatedAt: -1,
    createdAt: -1,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryBuilder = new QueryBuilder<TConversationLean>(baseQuery as any, query);

  const [conversations, meta] = await Promise.all([
    queryBuilder
      .paginate()
      .build()
      .populate({ path: 'lastMessage', select: CHAT_MESSAGE_SELECT })
      .populate({ path: 'participants', select: CHAT_CANDIDATE_SELECT })
      .lean<TConversationLean[]>(),
    queryBuilder.getMeta(),
  ]);

  interface TPopulatedParticipant {
    _id: Types.ObjectId;
    name?: string;
    images?: string[];
  };

  const data = conversations.map(({ participants, ...rest }) => {
    const opponent = (participants as unknown as TPopulatedParticipant[]).find(
      (p) => p._id.toString() !== query.candidateId,
    );

    return {
      ...buildConversationClientResponse(rest as TConversationLean, userId),
      opponent: opponent
        ? { ...opponent, image: opponent.images?.[0] ?? null, images: undefined }
        : null,
    };
  });

  


  return {meta, conversations: data,  };
};

// GET /conversations/:conversationId/messages - reads message history.
const getConversationMessages = async (
  userId: string,
  conversationId: string,
  query: IConversationMessagesQuery
) => {
  assertValidObjectId(conversationId, 'conversation id');
  assertValidObjectId(query.candidateId, 'candidate id');

  const conversation = await getConversationByIdOrThrow(conversationId);
  assertCandidateInConversation(conversation, query.candidateId);

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: query.candidateId,
    userId,
  });

  assertLinkedUserCanReadConversation({
    access,
    guardianParticipants: conversation.guardianParticipants,
  });

  const messageQuery: Record<string, unknown> = {
    conversation: new Types.ObjectId(conversationId),
  };
  const countQuery: Record<string, unknown> = { ...messageQuery };

  if (query.before) {
    const before = new Date(query.before);

    if (Number.isNaN(before.getTime())) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid before date');
    }

    messageQuery.createdAt = { $lt: before };
  }

  type TOpponentCandidate = { _id: Types.ObjectId; name?: string; images?: string[] };
  type TMessageWithCreatedAt = Record<string, unknown> & { createdAt?: Date };
  const skip = query.before ? 0 : (query.page - 1) * query.limit;

  const [messages, total, populatedConversation] = await Promise.all([
    Message.find(messageQuery)
      .select(CHAT_MESSAGE_SELECT)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit + 1)
      .lean<TMessageWithCreatedAt[]>(),
    Message.countDocuments(countQuery),
    Conversation.findById(conversationId)
      .populate({ path: 'participants', select: CHAT_CANDIDATE_SELECT })
      .lean(),
  ]);
  const hasMore = messages.length > query.limit;
  const paginatedMessages = messages.slice(0, query.limit);
  const oldestMessage = paginatedMessages[paginatedMessages.length - 1];

  const opponentRaw = (
    populatedConversation?.participants as unknown as TOpponentCandidate[]
  )?.find((p) => p._id.toString() !== query.candidateId);

  const opponent = opponentRaw
    ? {
        _id: opponentRaw._id,
        name: opponentRaw.name,
        image: opponentRaw.images?.[0] ?? null,
      }
    : null;

  return {
    meta: {
      hasMore,
      limit: query.limit,
      nextBefore: hasMore ? oldestMessage?.createdAt?.toISOString() ?? null : null,
      page: query.page,
      total,
      totalPage: Math.ceil(total / query.limit),
    },
    opponent,
    messages: paginatedMessages
      .reverse()
      .map((message) => buildMessageResponse(message)),
  };
};

// PATCH /conversations/:conversationId/read - clears unread count and emits read receipt.
const markConversationRead = async (
  userId: string,
  conversationId: string,
  payload: IRespondRequestPayload
) => {
  assertValidObjectId(conversationId, 'conversation id');
  assertValidObjectId(payload.candidateId, 'candidate id');

  const conversation = await getConversationByIdOrThrow(conversationId);
  assertCandidateInConversation(conversation, payload.candidateId);

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: payload.candidateId,
    userId,
  });

  assertLinkedUserCanReadConversation({
    access,
    guardianParticipants: conversation.guardianParticipants,
  });

  await Message.updateMany(
    {
      conversation: new Types.ObjectId(conversationId),
      seenBy: { $ne: new Types.ObjectId(userId) },
    },
    { $addToSet: { seenBy: new Types.ObjectId(userId) } }
  );

  await Conversation.findByIdAndUpdate(conversationId, {
    $set: { [`unreadCounts.${userId}`]: 0 },
  });

  const payloadData = {
    candidateId: payload.candidateId,
    conversationId,
    seenBy: userId,
  };

  emitChatEvent({
    conversationId,
    event: 'conversation:read',
    payload: payloadData,
    userIds: await getConversationAudienceUserIds(conversation),
  });

  return payloadData;
};

// POST /conversations/message-requests - asks another candidate to open chat.
const createMessageRequest = async (
  userId: string,
  payload: ICreateMessageRequestPayload
) => {
  assertValidObjectId(payload.requesterCandidateId, 'requester candidate id');
  assertValidObjectId(payload.targetCandidateId, 'target candidate id');

  if (payload.requesterCandidateId === payload.targetCandidateId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'You cannot send a message request to your own candidate profile'
    );
  }

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: payload.requesterCandidateId,
    userId,
  });

  assertWritableConversationAccess(access);

  const plan = await getCandidatePlanOrDefault(payload.requesterCandidateId);
  assertCanUseMessagingPlan(plan);

  await getActiveTargetCandidateOrThrow(payload.targetCandidateId);

  const pairKey = buildConversationPairKey(
    payload.requesterCandidateId,
    payload.targetCandidateId
  );

  const openConversation = await Conversation.exists({
    pairKey,
    status: ConversationStatus.OPEN,
  });

  if (openConversation) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'An open conversation already exists between these candidates'
    );
  }

  const encryptedInitialMessage = payload.initialMessage
    ? encryptChatText(payload.initialMessage)
    : null;

  let request: IConversationMessageRequest;

  try {
    request = await ConversationMessageRequest.create({
      pairKey,
      requesterCandidate: new Types.ObjectId(payload.requesterCandidateId),
      requesterLinkedUser: access._id,
      requesterUser: new Types.ObjectId(userId),
      status: ConversationMessageRequestStatus.PENDING,
      targetCandidate: new Types.ObjectId(payload.targetCandidateId),
      ...(encryptedInitialMessage && { initialMessage: encryptedInitialMessage }),
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) {
      throw error;
    }

    throw new AppError(
      StatusCodes.CONFLICT,
      'Message request already was sent!'
    );
  }

  const targetAudienceUserIds = await getCandidateAudienceUserIds([
    payload.targetCandidateId,
  ]);

  emitChatEvent({
    event: 'message-request:new',
    payload: { request },
    userIds: [userId, ...targetAudienceUserIds],
  });

  return request;
};

// GET /conversations/message-requests - lists incoming/outgoing chat requests.
const getMessageRequests = async (
  userId: string,
  query: IMessageRequestListQuery
) => {
  assertValidObjectId(query.candidateId, 'candidate id');

  await getActiveLinkedUserAccessOrThrow({
    candidateId: query.candidateId,
    userId,
  });

  const requestQuery: Record<string, unknown> = {};

  if (query.type === 'incoming') {
    requestQuery.targetCandidate = new Types.ObjectId(query.candidateId);
  } else if (query.type === 'outgoing') {
    requestQuery.requesterCandidate = new Types.ObjectId(query.candidateId);
  } else {
    requestQuery.$or = [
      { requesterCandidate: new Types.ObjectId(query.candidateId) },
      { targetCandidate: new Types.ObjectId(query.candidateId) },
    ];
  }

  if (query.status) {
    requestQuery.status = query.status;
  }

  const requests = await ConversationMessageRequest.find(requestQuery)
    .sort({ createdAt: -1 })
    .populate({ path: 'requesterCandidate', select: CHAT_CANDIDATE_SELECT })
    .lean();

  type TPopulatedCandidate = { _id: Types.ObjectId; name?: string; images?: string[] };

  return requests.map(({ requesterCandidate, initialMessage, ...rest }) => {
    let decryptedInitialMessage: string | null = null;

    if (initialMessage) {
      try {
        decryptedInitialMessage = decryptChatText({
          ...initialMessage,
          algorithm: initialMessage.algorithm as 'AES-256-GCM',
        });
      } catch {
        decryptedInitialMessage = null;
      }
    }

    return {
      ...rest,
      initialMessage: decryptedInitialMessage,
      requesterCandidate: requesterCandidate
        ? {
            ...(requesterCandidate as TPopulatedCandidate),
            image: (requesterCandidate as TPopulatedCandidate).images?.[0] ?? null,
            images: undefined,
          }
        : null,
    };
  });
};

// PATCH /conversations/message-requests/:requestId/accept - creates the chat.
const acceptMessageRequest = async (
  userId: string,
  requestId: string,
  payload: IRespondRequestPayload
) => {
  assertValidObjectId(requestId, 'message request id');
  assertValidObjectId(payload.candidateId, 'candidate id');

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: payload.candidateId,
    userId,
  });

  assertWritableConversationAccess(access);

  const request = await ConversationMessageRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: ConversationMessageRequestStatus.PENDING,
      targetCandidate: payload.candidateId,
    },
    {
      $set: {
        respondedAt: new Date(),
        status: ConversationMessageRequestStatus.ACCEPTED,
        targetRespondedBy: new Types.ObjectId(userId),
      },
    },
    { new: true, runValidators: true }
  ).lean<IConversationMessageRequest | null>();

  if (!request) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Message request was already handled'
    );
  }

  const participants = [
    request.requesterCandidate,
    request.targetCandidate,
  ] as Types.ObjectId[];

  const conversation = await Conversation.findOneAndUpdate(
    { pairKey: request.pairKey },
    {
      $set: {
        messageRequest: request._id,
        status: ConversationStatus.OPEN,
      },
      $setOnInsert: {
        pairKey: request.pairKey,
        parentInvolvement: false,
        participants,
        source: ConversationSource.MESSAGE_REQUEST,
      },
    },
    {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  ).lean<TConversationLean | null>();

  if (!conversation) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to create conversation from message request'
    );
  }

  await ConversationMessageRequest.findByIdAndUpdate(request._id, {
    $set: { conversation: conversation._id },
  });

  await RishtaProgressService.completeAutomaticStep({
    candidateIds: participants,
    completedBy: userId,
    conversationId: conversation._id,
    source: RishtaProgressStepSource.MESSAGE_REQUEST_ACCEPTED,
    step: RishtaProgressStep.START_CHAT,
  });

  const audienceUserIds = await getConversationAudienceUserIds(conversation);

  // If the requester included an initial message, persist it now as the first message
  // in the conversation using the same Message model structure as /messages POST.
  let initialMessageResponse: Record<string, unknown> | null = null;

  if (request.initialMessage) {
    const messageDoc = await Message.create({
      attachments: [],
      body: request.initialMessage,
      conversation: conversation._id,
      seenBy: [request.requesterUser],
      sender: request.requesterCandidate,
      sentBy: request.requesterUser,
      ...(request.requesterLinkedUser && {
        sentByLinkedUser: request.requesterLinkedUser,
      }),
      type: ChatMessageType.TEXT,
    });

    const savedMessage = await Message.findById(messageDoc._id)
      .select(CHAT_MESSAGE_SELECT)
      .lean();

    if (savedMessage) {
      initialMessageResponse = buildMessageResponse(savedMessage);

      const unreadIncrements = audienceUserIds
        .filter((id) => id !== request.requesterUser.toString())
        .reduce<Record<string, number>>((acc, id) => {
          acc[`unreadCounts.${id}`] = 1;
          return acc;
        }, {});

      await Conversation.findByIdAndUpdate(conversation._id, {
        $inc: unreadIncrements,
        $set: {
          lastMessage: messageDoc._id,
          [`unreadCounts.${request.requesterUser.toString()}`]: 0,
        },
      });

      emitChatEvent({
        conversationId: conversation._id.toString(),
        event: 'message:new',
        payload: {
          conversationId: conversation._id.toString(),
          message: initialMessageResponse,
        },
        userIds: audienceUserIds,
      });
    }
  }

  const responsePayload = {
    conversation,
    ...(initialMessageResponse && { initialMessage: initialMessageResponse }),
    request: {
      ...request,
      conversation: conversation._id,
    },
  };

  emitChatEvent({
    conversationId: conversation._id.toString(),
    event: 'message-request:accepted',
    payload: responsePayload,
    userIds: audienceUserIds,
  });

  emitChatEvent({
    conversationId: conversation._id.toString(),
    event: 'conversation:started',
    payload: responsePayload,
    userIds: audienceUserIds,
  });

  return responsePayload;
};

// PATCH /conversations/message-requests/:requestId/reject - rejects without deleting history.
const rejectMessageRequest = async (
  userId: string,
  requestId: string,
  payload: IRespondRequestPayload
) => {
  assertValidObjectId(requestId, 'message request id');
  assertValidObjectId(payload.candidateId, 'candidate id');

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: payload.candidateId,
    userId,
  });

  assertWritableConversationAccess(access);

  const request = await ConversationMessageRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: ConversationMessageRequestStatus.PENDING,
      targetCandidate: payload.candidateId,
    },
    {
      $set: {
        respondedAt: new Date(),
        status: ConversationMessageRequestStatus.REJECTED,
        targetRespondedBy: new Types.ObjectId(userId),
      },
    },
    { new: true, runValidators: true }
  ).lean<IConversationMessageRequest | null>();

  if (!request) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Pending message request not found for this candidate'
    );
  }

  const audienceUserIds = await getCandidateAudienceUserIds([
    request.requesterCandidate.toString(),
    request.targetCandidate.toString(),
  ]);

  emitChatEvent({
    event: 'message-request:rejected',
    payload: { request },
    userIds: audienceUserIds,
  });

  return request;
};

// POST /conversations/:conversationId/guardian-requests - asks opponent to include one guardian.
const createGuardianRequest = async (
  userId: string,
  conversationId: string,
  payload: ICreateGuardianRequestPayload
) => {

  // Check valid Objectid
  assertValidObjectId(conversationId, 'conversation id');
  assertValidObjectId(payload.candidateId, 'candidate id');
  assertValidObjectId(payload.linkedUserId, 'linked user id');

  const conversation = await getConversationByIdOrThrow(conversationId);

  if (conversation.status !== ConversationStatus.OPEN) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Guardian requests can only be sent for open conversations'
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
      'Viewer access cannot request guardian inclusion'
    );
  }

  const guardianAccess = await CandidateLinkedUser.findOne({
    _id: payload.linkedUserId,
    candidate: payload.candidateId,
    status: CandidateLinkedUserStatus.ACTIVE,
  })
    .select(
      '_id candidate user relationshipToCandidate accessRole status isPrimary linkedBy joinedAt removedAt createdAt updatedAt'
    )
    .lean<TActiveLinkedUserLean | null>();

  if (!guardianAccess) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Relative linked user not found'
    );
  }

  if (!isGuardianRelation(guardianAccess.relationshipToCandidate)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Only family, relative, guardian, or consultant linked users can be requested for chat inclusion'
    );
  }

  if (
    findActiveGuardianParticipant(conversation.guardianParticipants, guardianAccess)
  ) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This linked user is already included in the conversation'
    );
  }

  const targetCandidateId = getOtherConversationCandidateId(
    conversation,
    payload.candidateId
  );

  let request: IConversationGuardianRequest;

  try {
     request = await ConversationGuardianRequest.create({
      conversation: new Types.ObjectId(conversationId),
      match: conversation.match,
      message: payload.message?.trim(),
      pairKey: conversation.pairKey,
      requestedGuardianLinkedUser: guardianAccess._id,
      requestedGuardianUser: guardianAccess.user,
      requesterCandidate: new Types.ObjectId(payload.candidateId),
      requesterUser: new Types.ObjectId(userId),
      status: ConversationGuardianRequestStatus.PENDING,
      targetCandidate: new Types.ObjectId(targetCandidateId),
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) {
      throw error;
    }

    throw new AppError(
      StatusCodes.CONFLICT,
      'A pending guardian request already exists for this linked user'
    );
  }

  const targetAudienceUserIds = await getCandidateAudienceUserIds([
    targetCandidateId,
  ]);

  emitChatEvent({
    conversationId,
    event: 'guardian-request:new',
    payload: { request },
    userIds: [userId, ...targetAudienceUserIds],
  });

  return request;
};

// GET /conversations/guardian-requests - lists guardian include requests.
const getGuardianRequests = async (
  userId: string,
  query: IGuardianRequestListQuery
) => {
  assertValidObjectId(query.candidateId, 'candidate id');

  await getActiveLinkedUserAccessOrThrow({
    candidateId: query.candidateId,
    userId,
  });

  const requestQuery: Record<string, unknown> = {};

  if (query.type === 'incoming') {
    requestQuery.targetCandidate = new Types.ObjectId(query.candidateId);
  } else if (query.type === 'outgoing') {
    requestQuery.requesterCandidate = new Types.ObjectId(query.candidateId);
  } else {
    requestQuery.$or = [
      { requesterCandidate: new Types.ObjectId(query.candidateId) },
      { targetCandidate: new Types.ObjectId(query.candidateId) },
    ];
  }

  if (query.status) {
    requestQuery.status = query.status;
  }

  return ConversationGuardianRequest.find(requestQuery)
    .sort({ createdAt: -1 })
    .lean();
};

// PATCH /conversations/guardian-requests/:requestId/accept - includes the guardian.
const acceptGuardianRequest = async (
  userId: string,
  requestId: string,
  payload: IRespondRequestPayload
) => {
  assertValidObjectId(requestId, 'guardian request id');
  assertValidObjectId(payload.candidateId, 'candidate id');

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: payload.candidateId,
    userId,
  });

  assertWritableConversationAccess(access);

  const pendingRequest = await ConversationGuardianRequest.findOne({
    _id: requestId,
    status: ConversationGuardianRequestStatus.PENDING,
    targetCandidate: payload.candidateId,
  }).lean<IConversationGuardianRequest | null>();

  if (!pendingRequest) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'No pending guardian request found for this candidate'
    );
  }

  const pendingConversation = await getConversationByIdOrThrow(
    pendingRequest.conversation.toString()
  );


  // Guardian can include in only a open conversation otherwise not
  if (pendingConversation.status !== ConversationStatus.OPEN) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Guardian requests can only be accepted for open conversations'
    );
  }

  const request = await ConversationGuardianRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: ConversationGuardianRequestStatus.PENDING,
      targetCandidate: payload.candidateId,
    },
    {
      $set: {
        respondedAt: new Date(),
        status: ConversationGuardianRequestStatus.ACCEPTED,
        targetRespondedBy: new Types.ObjectId(userId),
      },
    },
    { new: true, runValidators: true }
  ).lean<IConversationGuardianRequest | null>();

  if (!request) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Guardian request was already handled'
    );
  }

  const activeParticipant = await Conversation.exists({
    _id: request.conversation,
    guardianParticipants: {
      $elemMatch: {
        candidate: request.requesterCandidate,
        isActive: true,
        linkedUser: request.requestedGuardianLinkedUser,
        user: request.requestedGuardianUser,
      },
    },
  });

  if (!activeParticipant) {
    await Conversation.findByIdAndUpdate(request.conversation, {
      $push: {
        guardianParticipants: {
          addedAt: new Date(),
          addedBy: request.requesterUser,
          candidate: request.requesterCandidate,
          isActive: true,
          linkedUser: request.requestedGuardianLinkedUser,
          user: request.requestedGuardianUser,
        },
      },
      $set: { parentInvolvement: true },
    });
  }

  const conversation = await Conversation.findById(request.conversation)
    .populate({ path: 'lastMessage', select: CHAT_MESSAGE_SELECT })
    .lean<TConversationLean | null>();

  if (!conversation) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Conversation not found');
  }

  const familyRelations = new Set([
    CandidateLinkedUserRelation.FATHER,
    CandidateLinkedUserRelation.MOTHER,
    CandidateLinkedUserRelation.BROTHER,
    CandidateLinkedUserRelation.SISTER,
    CandidateLinkedUserRelation.GUARDIAN,
    CandidateLinkedUserRelation.RELATIVE,
  ]);
  const acceptedLinkedUser = await CandidateLinkedUser.findById(
    request.requestedGuardianLinkedUser
  )
    .select('relationshipToCandidate')
    .lean<{ relationshipToCandidate: CandidateLinkedUserRelation } | null>();

  if (
    acceptedLinkedUser &&
    familyRelations.has(acceptedLinkedUser.relationshipToCandidate)
  ) {
    await RishtaProgressService.completeAutomaticStep({
      candidateIds: conversation.participants,
      completedBy: userId,
      conversationId: conversation._id,
      matchId: conversation.match,
      referenceId: request._id,
      source: RishtaProgressStepSource.GUARDIAN_ACCEPTED,
      step: RishtaProgressStep.PARENT_INVOLVES,
    });
  }

  const audienceUserIds = await getConversationAudienceUserIds(conversation);
  const responsePayload = { conversation, request };

  emitChatEvent({
    conversationId: request.conversation.toString(),
    event: 'guardian-request:accepted',
    payload: responsePayload,
    userIds: audienceUserIds,
  });

  emitChatEvent({
    conversationId: request.conversation.toString(),
    event: 'guardian:included',
    payload: responsePayload,
    userIds: audienceUserIds,
  });

  return responsePayload;
};

// PATCH /conversations/guardian-requests/:requestId/reject - leaves guardian outside chat.
const rejectGuardianRequest = async (
  userId: string,
  requestId: string,
  payload: IRespondRequestPayload
) => {
  assertValidObjectId(requestId, 'guardian request id');
  assertValidObjectId(payload.candidateId, 'candidate id');

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: payload.candidateId,
    userId,
  });

  assertWritableConversationAccess(access);

  const request = await ConversationGuardianRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: ConversationGuardianRequestStatus.PENDING,
      targetCandidate: payload.candidateId,
    },
    {
      $set: {
        respondedAt: new Date(),
        status: ConversationGuardianRequestStatus.REJECTED,
        targetRespondedBy: new Types.ObjectId(userId),
      },
    },
    { new: true, runValidators: true }
  ).lean<IConversationGuardianRequest | null>();

  if (!request) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Pending guardian request not found for this candidate'
    );
  }

  const audienceUserIds = await getCandidateAudienceUserIds([
    request.requesterCandidate.toString(),
    request.targetCandidate.toString(),
  ]);

  emitChatEvent({
    conversationId: request.conversation.toString(),
    event: 'guardian-request:rejected',
    payload: { request },
    userIds: audienceUserIds,
  });

  return request;
};

export const ConversationService = {
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
