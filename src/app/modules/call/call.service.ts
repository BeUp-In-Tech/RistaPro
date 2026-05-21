
import { RtcRole, RtcTokenBuilder } from 'agora-access-token';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import env from '../../config/env';
import AppError from '../../errorHelpers/AppError';
import { sendNotificationByBullMQ } from '../../utils/backgroundJobProcessingHelper';
import Candidate from '../candidate/candidate.model';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserRelation,
  CandidateLinkedUserStatus,
  TActiveLinkedUserLean,
} from '../candidate/linked-user/candidateLinkedUser.interface';
import CandidateLinkedUser from '../candidate/linked-user/candidateLinkedUser.model';
import {
  ConversationStatus,
} from '../conversation/conversation.interface';
import Conversation from '../conversation/conversation.model';
import { NotificationType } from '../notification/notification.interface';
import { PLANS } from '../plan/plan.constant';
import { IPlan, PLAN_KEYS, PlanKey } from '../plan/plan.interface';
import PlanModel from '../plan/plan.model';
import { emitChatEvent } from '../../socket/socket';
import { ActiveStatus } from '../user/user.interface';
import {
  CallParticipantRole,
  CallParticipantStatus,
  CallStatus,
  CallType,
  ICallCandidatePayload,
  IInviteCallParticipantPayload,
  IRespondCallParticipantPayload,
  IStartCallPayload,
  TCallLean,
  TCallParticipantForResponse,
  TConversationForCall,
} from './call.interface';
import Call from './call.model';


// Starts a one-to-one Agora call after checking chat access, plan limits, and receiver availability.
const startCall = async (userId: string, payload: IStartCallPayload) => {
  if (!Types.ObjectId.isValid(payload.conversationId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid conversation id');
  }

  if (!Types.ObjectId.isValid(payload.candidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }

  // Load independent caller context in parallel so the high-traffic start-call API stays quick.
  const [conversation, selfAccess, candidate] = await Promise.all([
    Conversation.findById(payload.conversationId)
      .select('_id match participants status guardianParticipants')
      .lean<TConversationForCall | null>(),
    CandidateLinkedUser.findOne({
      accessRole: CandidateLinkedUserAccessRole.OWNER,
      candidate: new Types.ObjectId(payload.candidateId),
      relationshipToCandidate: CandidateLinkedUserRelation.SELF,
      status: CandidateLinkedUserStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    })
      .select(
        '_id candidate user relationshipToCandidate accessRole status isPrimary linkedBy joinedAt removedAt createdAt updatedAt'
      )
      .lean<TActiveLinkedUserLean | null>(),
    Candidate.findById(payload.candidateId)
      .select('_id plan isActive user')
      .populate({
        path: 'user',
        select: '_id isActive isDeleted',
      })
      .lean<{
        _id: Types.ObjectId;
        isActive?: ActiveStatus;
        plan?: PlanKey;
        user:
          | Types.ObjectId
          | {
              _id: Types.ObjectId;
              isActive?: ActiveStatus;
              isDeleted?: boolean;
            }
          | null;
      } | null>(),
  ]);

  // Calls are allowed only inside an open conversation that contains the caller candidate.
  if (!conversation) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Conversation not found');
  }

  if (conversation.status !== ConversationStatus.OPEN) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Calls can only be started in open conversations'
    );
  }

  const participantIds = conversation.participants.map((id) => id.toString());
  if (!participantIds.includes(payload.candidateId)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This candidate does not belong to the conversation'
    );
  }

  if (!selfAccess) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only the owner can start a call'
    );
  }

  if (!candidate || candidate.isActive !== ActiveStatus.ACTIVE) {
    throw new AppError(StatusCodes.FORBIDDEN, 'Candidate profile is not active');
  }

  const owner =
    candidate.user &&
    typeof candidate.user === 'object' &&
    'isActive' in candidate.user
      ? candidate.user
      : null;

  if (!owner || owner.isDeleted || owner.isActive !== ActiveStatus.ACTIVE) {
    throw new AppError(StatusCodes.FORBIDDEN, 'Candidate owner is not active');
  }

  // Merge static plan defaults with any active database override before enforcing call access.
  const planKey = PLAN_KEYS.includes(candidate.plan as PlanKey)
    ? (candidate.plan as PlanKey)
    : 'free';
  const planDocument = await PlanModel.findOne({
    isActive: true,
    key: planKey,
  }).lean<IPlan | null>();
  const plan = {
    ...PLANS[planKey],
    ...(planDocument ?? {}),
  };

  if (payload.type === CallType.AUDIO && !plan.canAudioCall) {
    throw new AppError(
      StatusCodes.PAYMENT_REQUIRED,
      'Audio calls are not available on the current plan'
    );
  }

  if (payload.type === CallType.VIDEO && !plan.canVideoCall) {
    throw new AppError(
      StatusCodes.PAYMENT_REQUIRED,
      'Video calls are not available on the current plan'
    );
  }

  // Resolve the opposite candidate and block duplicate ringing/active calls in the same chat.
  const receiverCandidateId = conversation.participants
    .find((candidateId) => candidateId.toString() !== payload.candidateId)
    ?.toString();

  if (!receiverCandidateId) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Conversation receiver candidate not found'
    );
  }

  const [receiverSelfAccess, existingActiveCall] = await Promise.all([
    CandidateLinkedUser.findOne({
      accessRole: CandidateLinkedUserAccessRole.OWNER,
      candidate: new Types.ObjectId(receiverCandidateId),
      relationshipToCandidate: CandidateLinkedUserRelation.SELF,
      status: CandidateLinkedUserStatus.ACTIVE,
    })
      .select(
        '_id candidate user relationshipToCandidate accessRole status isPrimary linkedBy joinedAt removedAt createdAt updatedAt'
      )
      .lean<TActiveLinkedUserLean | null>(),
    Call.exists({
      conversation: conversation._id,
      status: { $in: [CallStatus.INITIATED, CallStatus.ACTIVE] },
    }),
  ]);

  if (!receiverSelfAccess) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Receiver SELF owner is not available for calls'
    );
  }

  if (existingActiveCall) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This conversation already has an active call'
    );
  }

  // Agora tokens are signed by this backend, so missing credentials fail before session creation.
  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Agora credentials are not configured'
    );
  }

  // Channel name and numeric UIDs are stored so every participant can renew tokens later.
  const callId = new Types.ObjectId();
  const channelName = `call_${callId.toString()}`;
  const ringTimeoutSeconds =
    Number.isFinite(env.CALL_RING_TIMEOUT_SECONDS) &&
    env.CALL_RING_TIMEOUT_SECONDS > 0
      ? env.CALL_RING_TIMEOUT_SECONDS
      : 60;
  const tokenTtlSeconds = Number.isFinite(env.AGORA_TOKEN_TTL_SECONDS)
    ? Math.min(Math.max(env.AGORA_TOKEN_TTL_SECONDS, 60), 86400)
    : 3600;
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + tokenTtlSeconds;
  const callerUid = Math.floor(Math.random() * 2147483000) + 1;
  let receiverUid = Math.floor(Math.random() * 2147483000) + 1;

  while (receiverUid === callerUid) {
    receiverUid = Math.floor(Math.random() * 2147483000) + 1;
  }

  // Caller joins immediately; receiver is stored as invited until they accept the ringing call.
  const call = await Call.create({
    _id: callId,
    callerCandidate: new Types.ObjectId(payload.candidateId),
    channelName,
    conversation: conversation._id,
    createdByLinkedUser: selfAccess._id,
    createdByUser: new Types.ObjectId(userId),
    match: conversation.match,
    participants: [
      {
        agoraUid: callerUid,
        candidate: selfAccess.candidate,
        joinedAt: new Date(),
        linkedUser: selfAccess._id,
        role: CallParticipantRole.CALLER,
        status: CallParticipantStatus.JOINED,
        user: selfAccess.user,
      },
      {
        agoraUid: receiverUid,
        candidate: receiverSelfAccess.candidate,
        invitedAt: new Date(),
        invitedByLinkedUser: selfAccess._id,
        invitedByUser: new Types.ObjectId(userId),
        linkedUser: receiverSelfAccess._id,
        role: CallParticipantRole.RECEIVER,
        status: CallParticipantStatus.INVITED,
        user: receiverSelfAccess.user,
      },
    ],
    receiverCandidate: receiverSelfAccess.candidate,
    ringExpiresAt: new Date(Date.now() + ringTimeoutSeconds * 1000),
    status: CallStatus.INITIATED,
    type: payload.type,
  });

  // Return only the caller token here; the receiver receives their token from the accept API.
  const token = RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    channelName,
    callerUid,
    RtcRole.PUBLISHER,
    expiresAtSeconds
  );
  const callResponse = call.toObject();
  const eventPayload = {
    call: callResponse,
    conversationId: conversation._id,
  };

  // Socket delivery is realtime, while push notification is queued without blocking the response.
  emitChatEvent({
    conversationId: conversation._id.toString(),
    event: 'call:ringing',
    payload: eventPayload,
    userIds: [receiverSelfAccess.user.toString(), userId],
  });

  void sendNotificationByBullMQ(
    {
      body: `Incoming ${payload.type.toLowerCase()} call`,
      data: {
        action: 'CALL_RINGING',
        callId: call._id.toString(),
        channelName,
        conversationId: conversation._id.toString(),
        type: payload.type,
      },
      deepLink: `${env.DEEP_LINK}calls/${call._id.toString()}`,
      entityId: call._id,
      title: 'Incoming call',
      type: NotificationType.CALL,
      user: receiverSelfAccess.user,
      webUrl: `/calls/${call._id.toString()}`,
    },
    `call_ringing_${call._id.toString()}_${receiverSelfAccess.user.toString()}`
  ).catch(() => undefined);

  return {
    agora: {
      appId: env.AGORA_APP_ID,
      channelName,
      expiresAt: new Date(expiresAtSeconds * 1000),
      token,
      uid: callerUid,
    },
    call: callResponse,
  };
};

// Receiver accepts a ringing call before timeout and receives their Agora token.
const acceptCall = async (
  userId: string,
  callId: string,
  payload: ICallCandidatePayload
) => {
  if (!Types.ObjectId.isValid(callId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid call id');
  }

  if (!Types.ObjectId.isValid(payload.candidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }

  // Fetch call state and receiver ownership together to keep the accept path lightweight.
  const [call, selfAccess] = await Promise.all([
    Call.findById(callId),
    CandidateLinkedUser.findOne({
      accessRole: CandidateLinkedUserAccessRole.OWNER,
      candidate: new Types.ObjectId(payload.candidateId),
      relationshipToCandidate: CandidateLinkedUserRelation.SELF,
      status: CandidateLinkedUserStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    })
      .select(
        '_id candidate user relationshipToCandidate accessRole status isPrimary linkedBy joinedAt removedAt createdAt updatedAt'
      )
      .lean<TActiveLinkedUserLean | null>(),
  ]);

  if (!call) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Call not found');
  }

  if (!selfAccess) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only the receiver SELF owner can accept this call'
    );
  }

  if (call.receiverCandidate.toString() !== payload.candidateId) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This candidate is not the receiver of this call'
    );
  }

  if (call.status !== CallStatus.INITIATED) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Only ringing calls can be accepted'
    );
  }

  // If the receiver answers after the ring window, finalize the call as missed before returning.
  if (call.ringExpiresAt.getTime() < Date.now()) {
    call.status = CallStatus.MISSED;
    call.endedAt = new Date();
    call.endReason = 'RING_TIMEOUT';
    await call.save();

    emitChatEvent({
      conversationId: call.conversation.toString(),
      event: 'call:ended',
      payload: { call: call.toObject() },
      userIds: call.participants.map((participant) => participant.user.toString()),
    });

    throw new AppError(StatusCodes.CONFLICT, 'Call ring timeout expired');
  }

  const participant = call.participants.find(
    (item) =>
      item.user.toString() === userId &&
      item.candidate.toString() === payload.candidateId &&
      item.role === CallParticipantRole.RECEIVER
  );

  if (!participant) {
    throw new AppError(StatusCodes.FORBIDDEN, 'Call receiver was not invited');
  }

  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Agora credentials are not configured'
    );
  }

  // Accepting moves the session from ringing to active and marks the receiver as joined.
  participant.status = CallParticipantStatus.JOINED;
  participant.joinedAt = new Date();
  call.status = CallStatus.ACTIVE;
  call.startedAt = new Date();
  await call.save();

  // Generate a fresh token for the receiver's stored UID in the same Agora channel.
  const tokenTtlSeconds = Number.isFinite(env.AGORA_TOKEN_TTL_SECONDS)
    ? Math.min(Math.max(env.AGORA_TOKEN_TTL_SECONDS, 60), 86400)
    : 3600;
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + tokenTtlSeconds;
  const token = RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    call.channelName,
    participant.agoraUid,
    RtcRole.PUBLISHER,
    expiresAtSeconds
  );
  const callResponse = call.toObject();

  emitChatEvent({
    conversationId: call.conversation.toString(),
    event: 'call:accepted',
    payload: { call: callResponse },
    userIds: call.participants.map((item) => item.user.toString()),
  });

  return {
    agora: {
      appId: env.AGORA_APP_ID,
      channelName: call.channelName,
      expiresAt: new Date(expiresAtSeconds * 1000),
      token,
      uid: participant.agoraUid,
    },
    call: callResponse,
  };
};

// Receiver rejects a ringing call and closes the session for every participant.
const rejectCall = async (
  userId: string,
  callId: string,
  payload: ICallCandidatePayload
) => {
  if (!Types.ObjectId.isValid(callId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid call id');
  }

  if (!Types.ObjectId.isValid(payload.candidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }

  // Only the receiver SELF owner can reject, so resolve the call and receiver access together.
  const [call, selfAccess] = await Promise.all([
    Call.findById(callId),
    CandidateLinkedUser.findOne({
      accessRole: CandidateLinkedUserAccessRole.OWNER,
      candidate: new Types.ObjectId(payload.candidateId),
      relationshipToCandidate: CandidateLinkedUserRelation.SELF,
      status: CandidateLinkedUserStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    })
      .select('_id candidate user relationshipToCandidate accessRole status')
      .lean<TActiveLinkedUserLean | null>(),
  ]);

  if (!call) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Call not found');
  }

  if (!selfAccess || call.receiverCandidate.toString() !== payload.candidateId) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only the receiver SELF owner can reject this call'
    );
  }

  if (call.status !== CallStatus.INITIATED) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Only ringing calls can be rejected'
    );
  }

  const participant = call.participants.find(
    (item) =>
      item.user.toString() === userId &&
      item.candidate.toString() === payload.candidateId
  );

  // Keep participant-level status aligned with the final call status for clean history reads.
  if (participant) {
    participant.status = CallParticipantStatus.REJECTED;
    participant.rejectedAt = new Date();
  }

  call.status = CallStatus.REJECTED;
  call.endedAt = new Date();
  call.endedByUser = new Types.ObjectId(userId);
  call.endReason = 'RECEIVER_REJECTED';
  await call.save();

  const callResponse = call.toObject();
  emitChatEvent({
    conversationId: call.conversation.toString(),
    event: 'call:rejected',
    payload: { call: callResponse },
    userIds: call.participants.map((item) => item.user.toString()),
  });

  return callResponse;
};

// Any joined participant can end an initiated or active call.
const endCall = async (
  userId: string,
  callId: string,
  payload: ICallCandidatePayload
) => {
  if (!Types.ObjectId.isValid(callId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid call id');
  }

  if (!Types.ObjectId.isValid(payload.candidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }

  const call = await Call.findById(callId);

  if (!call) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Call not found');
  }

  if (
    ![CallStatus.INITIATED, CallStatus.ACTIVE].includes(call.status)
  ) {
    throw new AppError(StatusCodes.CONFLICT, 'Call is already ended');
  }

  // Ending is limited to users who are currently joined under the supplied candidate.
  const participant = call.participants.find(
    (item) =>
      item.user.toString() === userId &&
      item.candidate.toString() === payload.candidateId &&
      item.status === CallParticipantStatus.JOINED
  );

  if (!participant) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only active call participants can end this call'
    );
  }

  // Preserve whether this was a caller cancellation or a normal active-call ending.
  const previousStatus = call.status;
  participant.status = CallParticipantStatus.LEFT;
  participant.leftAt = new Date();
  call.status = CallStatus.COMPLETED;
  call.endedAt = new Date();
  call.endedByUser = new Types.ObjectId(userId);
  call.endReason =
    previousStatus === CallStatus.INITIATED ? 'CALL_CANCELLED' : 'ENDED_BY_USER';
  await call.save();

  const callResponse = call.toObject();
  emitChatEvent({
    conversationId: call.conversation.toString(),
    event: 'call:ended',
    payload: { call: callResponse },
    userIds: call.participants.map((item) => item.user.toString()),
  });

  return callResponse;
};

// Renews an Agora token for a user who is already joined in an active call.
const renewCallToken = async (
  userId: string,
  callId: string,
  payload: ICallCandidatePayload
) => {
  if (!Types.ObjectId.isValid(callId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid call id');
  }

  if (!Types.ObjectId.isValid(payload.candidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }

  const call = await Call.findById(callId).lean<TCallLean | null>();

  if (!call) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Call not found');
  }

  if (call.status !== CallStatus.ACTIVE) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Tokens can only be renewed for active calls'
    );
  }

  // Token renewal never adds access; it only re-signs access for an existing joined participant.
  const participant = call.participants.find(
    (item) =>
      item.user.toString() === userId &&
      item.candidate.toString() === payload.candidateId &&
      item.status === CallParticipantStatus.JOINED
  ) as TCallParticipantForResponse | undefined;

  if (!participant) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You are not an active participant in this call'
    );
  }

  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Agora credentials are not configured'
    );
  }

  // Clamp token TTL to Agora's 24-hour maximum and avoid very short accidental expiries.
  const tokenTtlSeconds = Number.isFinite(env.AGORA_TOKEN_TTL_SECONDS)
    ? Math.min(Math.max(env.AGORA_TOKEN_TTL_SECONDS, 60), 86400)
    : 3600;
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + tokenTtlSeconds;
  const token = RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    call.channelName,
    participant.agoraUid,
    RtcRole.PUBLISHER,
    expiresAtSeconds
  );

  return {
    appId: env.AGORA_APP_ID,
    channelName: call.channelName,
    expiresAt: new Date(expiresAtSeconds * 1000),
    token,
    uid: participant.agoraUid,
  };
};

// Candidate SELF owner invites an already-approved linked user into the active call.
const inviteCallParticipant = async (
  userId: string,
  callId: string,
  payload: IInviteCallParticipantPayload
) => {
  if (!Types.ObjectId.isValid(callId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid call id');
  }

  if (!Types.ObjectId.isValid(payload.candidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }

  if (!Types.ObjectId.isValid(payload.linkedUserId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid linked user id');
  }

  // Load call state and inviter ownership in parallel before checking invitation rules.
  const [call, selfAccess] = await Promise.all([
    Call.findById(callId),
    CandidateLinkedUser.findOne({
      accessRole: CandidateLinkedUserAccessRole.OWNER,
      candidate: new Types.ObjectId(payload.candidateId),
      relationshipToCandidate: CandidateLinkedUserRelation.SELF,
      status: CandidateLinkedUserStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    })
      .select('_id candidate user relationshipToCandidate accessRole status')
      .lean<TActiveLinkedUserLean | null>(),
  ]);

  if (!call) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Call not found');
  }

  if (call.status !== CallStatus.ACTIVE) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Linked users can be invited only to active calls'
    );
  }

  if (!selfAccess) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only the candidate SELF owner can invite linked users to this call'
    );
  }

  // The inviter must already be in the Agora room, preventing outside users from adding guests.
  const ownerParticipant = call.participants.find(
    (item) =>
      item.user.toString() === userId &&
      item.candidate.toString() === payload.candidateId &&
      item.status === CallParticipantStatus.JOINED
  );

  if (!ownerParticipant) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'The inviter must already be joined in this call'
    );
  }

  // Count joined plus pending invitations so the configured participant cap is enforced early.
  const activeOrInvitedCount = call.participants.filter(
    (item) =>
      item.status === CallParticipantStatus.JOINED ||
      item.status === CallParticipantStatus.INVITED
  ).length;
  const maxParticipants =
    Number.isFinite(env.CALL_MAX_PARTICIPANTS) && env.CALL_MAX_PARTICIPANTS >= 2
      ? env.CALL_MAX_PARTICIPANTS
      : 6;

  if (activeOrInvitedCount >= maxParticipants) {
    throw new AppError(
      StatusCodes.CONFLICT,
      `A call can have at most ${maxParticipants} participants`
    );
  }

  // Verify the linked user is active and already attached to this conversation as a guardian.
  const [conversation, linkedUser] = await Promise.all([
    Conversation.findById(call.conversation)
      .select('_id participants guardianParticipants status')
      .lean<TConversationForCall | null>(),
    CandidateLinkedUser.findOne({
      _id: new Types.ObjectId(payload.linkedUserId),
      candidate: new Types.ObjectId(payload.candidateId),
      status: CandidateLinkedUserStatus.ACTIVE,
    })
      .select(
        '_id candidate user relationshipToCandidate accessRole status isPrimary linkedBy joinedAt removedAt createdAt updatedAt'
      )
      .lean<TActiveLinkedUserLean | null>(),
  ]);

  if (!conversation || conversation.status !== ConversationStatus.OPEN) {
    throw new AppError(StatusCodes.CONFLICT, 'Conversation is not open');
  }

  if (!linkedUser) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Linked user not found');
  }

  // This keeps call invitations limited to linked users who were approved for this chat.
  const isConversationGuardian = conversation.guardianParticipants?.some(
    (participant) =>
      participant.isActive &&
      participant.candidate.toString() === payload.candidateId &&
      participant.linkedUser.toString() === payload.linkedUserId &&
      participant.user.toString() === linkedUser.user.toString()
  );

  if (!isConversationGuardian) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only linked users already involved in this conversation can be invited'
    );
  }

  const existingParticipant = call.participants.find(
    (item) =>
      item.linkedUser.toString() === payload.linkedUserId &&
      (item.status === CallParticipantStatus.INVITED ||
        item.status === CallParticipantStatus.JOINED)
  );

  if (existingParticipant) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This linked user is already invited or joined'
    );
  }

  // Generate a unique numeric Agora UID for the invited participant before saving the invite.
  const usedUids = new Set(call.participants.map((item) => item.agoraUid));
  let agoraUid = Math.floor(Math.random() * 2147483000) + 1;

  while (usedUids.has(agoraUid)) {
    agoraUid = Math.floor(Math.random() * 2147483000) + 1;
  }

  // Save the invited participant first, then notify everyone from the persisted call state.
  call.participants.push({
    agoraUid,
    candidate: linkedUser.candidate,
    invitedAt: new Date(),
    invitedByLinkedUser: selfAccess._id,
    invitedByUser: new Types.ObjectId(userId),
    linkedUser: linkedUser._id,
    role: CallParticipantRole.INVITED_LINKED_USER,
    status: CallParticipantStatus.INVITED,
    user: linkedUser.user,
  });
  await call.save();

  const callResponse = call.toObject();
  emitChatEvent({
    conversationId: call.conversation.toString(),
    event: 'call:participant-invited',
    payload: {
      call: callResponse,
      invitedLinkedUserId: linkedUser._id,
      invitedUserId: linkedUser.user,
    },
    userIds: [
      linkedUser.user.toString(),
      ...call.participants.map((item) => item.user.toString()),
    ],
  });

  void sendNotificationByBullMQ(
    {
      body: 'You have been invited to join a call',
      data: {
        action: 'CALL_PARTICIPANT_INVITED',
        callId: call._id.toString(),
        channelName: call.channelName,
        conversationId: call.conversation.toString(),
        linkedUserId: linkedUser._id.toString(),
      },
      deepLink: `${env.DEEP_LINK}calls/${call._id.toString()}`,
      entityId: call._id,
      title: 'Call invitation',
      type: NotificationType.CALL,
      user: linkedUser.user,
      webUrl: `/calls/${call._id.toString()}`,
    },
    `call_invite_${call._id.toString()}_${linkedUser.user.toString()}`
  ).catch(() => undefined);

  return callResponse;
};

// Invited linked users can either join with a token or reject the invitation.
const respondCallParticipant = async (
  userId: string,
  callId: string,
  payload: IRespondCallParticipantPayload
) => {
  if (!Types.ObjectId.isValid(callId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid call id');
  }

  if (!Types.ObjectId.isValid(payload.candidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }

  if (!Types.ObjectId.isValid(payload.linkedUserId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid linked user id');
  }

  // Confirm the logged-in user owns this linked-user invitation before changing call state.
  const [call, linkedUser] = await Promise.all([
    Call.findById(callId),
    CandidateLinkedUser.findOne({
      _id: new Types.ObjectId(payload.linkedUserId),
      candidate: new Types.ObjectId(payload.candidateId),
      status: CandidateLinkedUserStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    })
      .select(
        '_id candidate user relationshipToCandidate accessRole status isPrimary linkedBy joinedAt removedAt createdAt updatedAt'
      )
      .lean<TActiveLinkedUserLean | null>(),
  ]);

  if (!call) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Call not found');
  }

  if (call.status !== CallStatus.ACTIVE) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Linked user invitations can only be answered for active calls'
    );
  }

  if (!linkedUser) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This linked user invitation does not belong to the current user'
    );
  }

  const participant = call.participants.find(
    (item) =>
      item.linkedUser.toString() === payload.linkedUserId &&
      item.candidate.toString() === payload.candidateId &&
      item.user.toString() === userId &&
      item.role === CallParticipantRole.INVITED_LINKED_USER
  );

  if (!participant) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Call invitation not found');
  }

  if (participant.status !== CallParticipantStatus.INVITED) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This call invitation was already handled'
    );
  }

  // Rejection is a final participant-level state and does not end the whole call.
  if (payload.action === 'REJECT') {
    participant.status = CallParticipantStatus.REJECTED;
    participant.rejectedAt = new Date();
    await call.save();

    const callResponse = call.toObject();
    emitChatEvent({
      conversationId: call.conversation.toString(),
      event: 'call:participant-rejected',
      payload: {
        call: callResponse,
        linkedUserId: linkedUser._id,
        userId,
      },
      userIds: call.participants.map((item) => item.user.toString()),
    });

    return {
      call: callResponse,
      joined: false,
    };
  }

  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Agora credentials are not configured'
    );
  }

  // Accepting the invite joins the existing Agora channel using the participant's stored UID.
  participant.status = CallParticipantStatus.JOINED;
  participant.joinedAt = new Date();
  await call.save();

  const tokenTtlSeconds = Number.isFinite(env.AGORA_TOKEN_TTL_SECONDS)
    ? Math.min(Math.max(env.AGORA_TOKEN_TTL_SECONDS, 60), 86400)
    : 3600;
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + tokenTtlSeconds;
  const token = RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    call.channelName,
    participant.agoraUid,
    RtcRole.PUBLISHER,
    expiresAtSeconds
  );
  const callResponse = call.toObject();

  emitChatEvent({
    conversationId: call.conversation.toString(),
    event: 'call:participant-joined',
    payload: {
      call: callResponse,
      linkedUserId: linkedUser._id,
      userId,
    },
    userIds: call.participants.map((item) => item.user.toString()),
  });

  return {
    agora: {
      appId: env.AGORA_APP_ID,
      channelName: call.channelName,
      expiresAt: new Date(expiresAtSeconds * 1000),
      token,
      uid: participant.agoraUid,
    },
    call: callResponse,
    joined: true,
  };
};

// Lightweight call-state read for users already listed as participants.
const getCall = async (userId: string, callId: string) => {
  if (!Types.ObjectId.isValid(callId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid call id');
  }

  const call = await Call.findById(callId).lean<TCallLean | null>();

  if (!call) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Call not found');
  }

  // A call can be read by any user who appears on the participant list.
  const canRead = call.participants.some(
    (participant) => participant.user.toString() === userId
  );

  if (!canRead) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You are not a participant in this call'
    );
  }

  return call;
};

export const CallService = {
  acceptCall,
  endCall,
  getCall,
  inviteCallParticipant,
  rejectCall,
  renewCallToken,
  respondCallParticipant,
  startCall,
};
