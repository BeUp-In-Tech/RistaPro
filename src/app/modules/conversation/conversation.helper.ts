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
  '_id name dateOfBirth gender images religion address user';

export const CHAT_MESSAGE_SELECT =
  '_id conversation sender sentBy sentByLinkedUser message type seenBy replyTo metadata createdAt';

export const assertValidObjectId = (id: string, fieldLabel: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid ${fieldLabel}`);
  }

  return id;
};

export const buildConversationPairKey = (
  firstCandidateId: string,
  secondCandidateId: string
) => [firstCandidateId, secondCandidateId].sort().join('_');

const getPlanKeyOrDefault = (plan?: string): PlanKey =>
  PLAN_KEYS.includes(plan as PlanKey) ? (plan as PlanKey) : 'free';

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

export const assertCanUseMessagingPlan = (plan: Pick<IPlan, 'canMessage'>) => {
  if (!plan.canMessage) {
    throw new AppError(
      StatusCodes.PAYMENT_REQUIRED,
      'Messaging is not available on the current plan'
    );
  }
};

export const isViewerAccess = (access: TActiveLinkedUserLean) =>
  access.accessRole === CandidateLinkedUserAccessRole.VIEWER;

export const isWritableLinkedUser = (accessRole: CandidateLinkedUserAccessRole) =>
  accessRole === CandidateLinkedUserAccessRole.OWNER ||
  accessRole === CandidateLinkedUserAccessRole.EDITOR;

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

export const getConversationByIdOrThrow = async (conversationId: string) => {
  assertValidObjectId(conversationId, 'conversation id');

  const conversation = await Conversation.findById(conversationId).lean();

  if (!conversation) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Conversation not found');
  }

  return conversation;
};

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

export const buildConversationResponse = (
  conversation: TConversationLean,
  userId: string
) => ({
  ...conversation,
  unreadCount: getUnreadCountForUser(conversation.unreadCounts, userId),
});

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

export const getConversationCandidateIds = (conversation: {
  participants: Types.ObjectId[];
}) => conversation.participants.map((candidateId) => candidateId.toString());

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

export const assertLinkedUserCanReadConversation = (params: {
  access: TActiveLinkedUserLean;
  guardianParticipants?: IConversationGuardianParticipant[];
}) => {
  const { access, guardianParticipants } = params;

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
