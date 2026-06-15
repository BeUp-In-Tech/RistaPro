import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errorHelpers/AppError';
import Candidate from '../candidate/candidate.model';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserRelation,
  CandidateLinkedUserStatus,
  TActiveLinkedUserLean,
} from '../candidate/linked-user/candidateLinkedUser.interface';
import CandidateLinkedUser from '../candidate/linked-user/candidateLinkedUser.model';
import { PLANS } from '../plan/plan.constant';
import { IPlan, PLAN_KEYS, PlanKey } from '../plan/plan.interface';
import PlanModel from '../plan/plan.model';
import { ActiveStatus } from '../user/user.interface';
import Conversation from './conversation.model';
import {
  IConversation,
  IConversationGuardianParticipant,
  TConversationLean,
} from './conversation.interface';

export const CHAT_CANDIDATE_SELECT =
  '_id name images';

export const CHAT_MESSAGE_SELECT =
  '_id conversation sender sentBy sentByLinkedUser senderDeviceId type body attachments encryptionVersion seenBy replyTo metadata createdAt';

// Validate that `id` is a valid Mongo ObjectId or throw a bad-request error
export const assertValidObjectId = (id: string, fieldLabel: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid ${fieldLabel}`);
  }

  return id;
};

// Build a stable pair key for two candidate ids (sorted and joined)
export const buildConversationPairKey = (
  firstCandidateId: string,
  secondCandidateId: string
) => [firstCandidateId, secondCandidateId].sort().join('_');

// Resolve a plan key or fallback to 'free'
const getPlanKeyOrDefault = (plan?: string): PlanKey =>
  PLAN_KEYS.includes(plan as PlanKey) ? (plan as PlanKey) : 'free';

// Load candidate's plan and return plan details with defaults
export const getCandidatePlanOrDefault = async (candidateId: string) => {
  const candidate = await Candidate.findById(candidateId)
    .select('_id plan user isActive')
    .populate({
      path: 'user',
      select: '_id isActive isDeleted',
    })
    .lean<{
      _id: Types.ObjectId;
      plan?: PlanKey;
      isActive?: ActiveStatus;
      user:
        | Types.ObjectId
        | {
            _id: Types.ObjectId;
            isActive?: ActiveStatus;
            isDeleted?: boolean;
          }
        | null;
    } | null>();

  if (!candidate || candidate.isActive !== ActiveStatus.ACTIVE) {
    throw new AppError(StatusCodes.FORBIDDEN, 'Candidate profile is not active');
  }

  const owner =
    candidate.user && typeof candidate.user === 'object' && 'isActive' in candidate.user
      ? candidate.user
      : null;

  if (!owner || owner.isDeleted || owner.isActive !== ActiveStatus.ACTIVE) {
    throw new AppError(StatusCodes.FORBIDDEN, 'Candidate owner is not active');
  }

  const planKey = getPlanKeyOrDefault(candidate.plan);
  const planDocument = await PlanModel.findOne({
    isActive: true,
    key: planKey,
  }).lean<IPlan | null>();

  return {
    ...PLANS[planKey],
    ...(planDocument ?? {}),
  };
};

// Ensure the candidate's plan allows messaging or throw a payment-required error
export const assertCanUseMessagingPlan = (plan: Pick<IPlan, 'canMessage'>) => {
  if (!plan.canMessage) {
    throw new AppError(
      StatusCodes.PAYMENT_REQUIRED,
      'Messaging is not available on the current plan'
    );
  }
};

// True when the linked-user has view-only access
export const isViewerAccess = (access: TActiveLinkedUserLean) =>
  access.accessRole === CandidateLinkedUserAccessRole.VIEWER;

// True when the linked-user can perform write actions (owner or editor)
export const isWritableLinkedUser = (accessRole: CandidateLinkedUserAccessRole) =>
  accessRole === CandidateLinkedUserAccessRole.OWNER ||
  accessRole === CandidateLinkedUserAccessRole.EDITOR;


// Check whether a linked-user relation qualifies as a guardian/relative
export const isGuardianRelation = (
  relation: CandidateLinkedUserRelation
) =>
  relation === CandidateLinkedUserRelation.FATHER ||
  relation === CandidateLinkedUserRelation.MOTHER ||
  relation === CandidateLinkedUserRelation.BROTHER ||
  relation === CandidateLinkedUserRelation.SISTER ||
  relation === CandidateLinkedUserRelation.GUARDIAN ||
  relation === CandidateLinkedUserRelation.RELATIVE ||
  relation === CandidateLinkedUserRelation.CONSULTANT;


// Load conversation by id or throw not-found
export const getConversationByIdOrThrow = async (conversationId: string) => {
  assertValidObjectId(conversationId, 'conversation id');

  const conversation = await Conversation.findById(conversationId).lean();

  if (!conversation) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Conversation not found');
  }

  return conversation;
};

// Return unread count for a specific user from conversation unreadCounts
export const getUnreadCountForUser = (
  unreadCounts:
    | IConversation['unreadCounts']
    | Record<string, number>
    | undefined,
  userId: string
) => {
  if (!unreadCounts) {
    return 0;
  }

  if (unreadCounts instanceof Map) {
    return unreadCounts.get(userId) ?? 0;
  }

  return Number(unreadCounts[userId] ?? 0);
};

// Build conversation response including unreadCount for the requesting user
export const buildConversationResponse = (
  conversation: TConversationLean,
  userId: string
) => ({
  ...conversation,
  unreadCount: getUnreadCountForUser(conversation.unreadCounts, userId),
});

// Throw if linked-user has viewer-only access (can't write/respond)
export const assertWritableConversationAccess = (
  access: TActiveLinkedUserLean
) => {
  if (isViewerAccess(access)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Viewer access cannot respond to chat requests'
    );
  }
};

// Ensure target candidate exists and is active
export const getActiveTargetCandidateOrThrow = async (candidateId: string) => {
  const candidate = await Candidate.findOne({
    _id: candidateId,
    isActive: ActiveStatus.ACTIVE,
  })
    .select('_id user isActive')
    .lean<{ _id: Types.ObjectId; user: Types.ObjectId } | null>();

  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Target candidate not found');
  }

  return candidate;
};

// Helper to get participant candidate ids as strings
export const getConversationCandidateIds = (conversation: {
  participants: Types.ObjectId[];
}) => conversation.participants.map((candidateId) => candidateId.toString());


// Assert the provided candidateId is one of the conversation participants
export const assertCandidateInConversation = (
  conversation: { participants: Types.ObjectId[] },
  candidateId: string
) => {
  const belongs = conversation.participants.some(
    (participant) => participant.toString() === candidateId
  );

  if (!belongs) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This candidate does not belong to the conversation'
    );
  }
};

// Return the other participant candidate id (conversation must have two participants)
export const getOtherConversationCandidateId = (
  conversation: { participants: Types.ObjectId[] },
  candidateId: string
) => {
  const otherCandidate = conversation.participants.find(
    (participant) => participant.toString() !== candidateId
  );

  if (!otherCandidate) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Conversation must contain two candidate participants'
    );
  }

  return otherCandidate.toString();
};

// Find an active guardian participant record that matches the linked-user access
export const findActiveGuardianParticipant = (
  guardianParticipants: IConversationGuardianParticipant[] | undefined,
  access: TActiveLinkedUserLean
) =>
  guardianParticipants?.find(
    (participant) =>
      participant.isActive &&
      participant.candidate.toString() === access.candidate.toString() &&
      participant.linkedUser.toString() === access._id.toString() &&
      participant.user.toString() === access.user.toString()
  );

// Ensure a linked-user (including guardians) is authorized to read the conversation
export const assertLinkedUserCanReadConversation = (params: {
  access: TActiveLinkedUserLean;
  guardianParticipants?: IConversationGuardianParticipant[];
}) => {
  const { access, guardianParticipants } = params;

  // Check guardian relation
  if (!isGuardianRelation(access.relationshipToCandidate)) {
    return;
  }

  if (access.isPrimary) {
    return;
  }

  const approvedGuardian = findActiveGuardianParticipant(
    guardianParticipants,
    access
  );

  if (!approvedGuardian) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This guardian or parent has not been approved for this conversation'
    );
  }
};

// Ensure a linked-user is allowed to send messages (write + read checks)
export const assertLinkedUserCanSendMessage = (params: {
  access: TActiveLinkedUserLean;
  guardianParticipants?: IConversationGuardianParticipant[];
}) => {
  const { access, guardianParticipants } = params;

  if (!isWritableLinkedUser(access.accessRole)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Viewer access cannot send chat messages'
    );
  }

  assertLinkedUserCanReadConversation({ access, guardianParticipants });
};

// Get audience user ids for a set of candidates (owners + non-guardian linked users)
export const getCandidateAudienceUserIds = async (candidateIds: string[]) => {
  const [candidateOwners, linkedUsers] = await Promise.all([
    Candidate.find({
      _id: { $in: candidateIds.map((id) => new Types.ObjectId(id)) },
      isActive: ActiveStatus.ACTIVE,
    })
      .select('user')
      .lean<{ user: Types.ObjectId }[]>(),
    CandidateLinkedUser.find({
      candidate: { $in: candidateIds.map((id) => new Types.ObjectId(id)) },
      status: CandidateLinkedUserStatus.ACTIVE,
    })
      .select('user relationshipToCandidate')
      .lean<
        {
          relationshipToCandidate: CandidateLinkedUserRelation;
          user: Types.ObjectId;
        }[]
      >(),
  ]);

  return Array.from(
    new Set([
      ...candidateOwners.map((candidate) => candidate.user.toString()),
      ...linkedUsers
        .filter(
          (linkedUser) =>
            !isGuardianRelation(linkedUser.relationshipToCandidate)
        )
        .map((linkedUser) => linkedUser.user.toString()),
    ])
  );
};

// Get audience user ids for a conversation (includes active guardians)
export const getConversationAudienceUserIds = async (conversation: {
  participants: Types.ObjectId[];
  guardianParticipants?: IConversationGuardianParticipant[];
}) => {
  const candidateUserIds = await getCandidateAudienceUserIds(
    getConversationCandidateIds(conversation)
  );
  const guardianUserIds =
    conversation.guardianParticipants
      ?.filter((participant) => participant.isActive)
      .map((participant) => participant.user.toString()) ?? [];

  return Array.from(new Set([...candidateUserIds, ...guardianUserIds]));
};
