import { StatusCodes } from 'http-status-codes';
import { FilterQuery, Types } from 'mongoose';
import env from '../../config/env';
import AppError from '../../errorHelpers/AppError';
import { sendNotificationByBullMQ } from '../../utils/backgroundJobProcessingHelper';
import { QueryBuilder } from '../../utils/QueryBuilder';
import Candidate from '../candidate/candidate.model';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserRelation,
  CandidateLinkedUserStatus,
  TActiveLinkedUserLean,
} from '../candidate/linked-user/candidateLinkedUser.interface';
import CandidateLinkedUser from '../candidate/linked-user/candidateLinkedUser.model';
import {
  getActiveLinkedUserAccessOrThrow,
  syncLegacyOwnerLinks,
} from '../candidate/linked-user/candidateLinkedUser.helper';
import Conversation from '../conversation/conversation.model';
import Match from '../match/match.model';
import { NotificationType } from '../notification/notification.interface';
import { clearSwipeFeedSessionsForCandidate } from '../swipe/swipe.helper';
import { ActiveStatus, Role } from '../user/user.interface';
import {
  IAdminMarkMarriedPayload,
  ICreateMarriageRequestPayload,
  IMarriedListQuery,
  IRespondMarriageRequestPayload,
  IRishtaMarriageRequestCandidateCard,
  IRishtaMarriageRequestListItem,
  IRishtaMarriageRequestListQuery,
  IRishtaMarriageRequestListResponse,
  IRishtaMarriageRequestUserInfo,
  IRishtaMarriageRequest,
  IRishtaPairLocator,
  IRishtaProgress,
  IRishtaProgressQuery,
  RishtaMarriageRequestStatus,
  RishtaProgressStatus,
  RishtaProgressStep,
  RishtaProgressStepSource,
} from './rishta_progress.interface';
import RishtaProgress, {
  RishtaMarriageRequest,
} from './rishta_progress.model';

const PROGRESS_STEPS = [
  RishtaProgressStep.MATCHES,
  RishtaProgressStep.START_CHAT,
  RishtaProgressStep.PARENT_INVOLVES,
  RishtaProgressStep.SHAADI,
];

const PROGRESS_CANDIDATE_SELECT =
  '_id name dateOfBirth gender images religion address';
const MARRIAGE_REQUEST_CANDIDATE_SELECT =
  '_id name dateOfBirth gender images religion address occupation';
const MARRIAGE_REQUEST_USER_SELECT =
  '_id full_name email phone picture role';

type TMarriageRequestCandidateLean = Pick<
  IRishtaMarriageRequestCandidateCard,
  '_id' | 'gender' | 'name' | 'occupation' | 'religion'
> & {
  address?: string;
  dateOfBirth: Date;
  images?: string[];
};

type TMarriageRequestUserLean = IRishtaMarriageRequestUserInfo;

interface TMarriageRequestListLean {
  _id: Types.ObjectId;
  approvals: IRishtaMarriageRequest['approvals'];
  candidates: (Types.ObjectId | TMarriageRequestCandidateLean)[];
  createdAt?: Date;
  pairKey: string;
  progress: Types.ObjectId;
  requestedByCandidate?: Types.ObjectId | TMarriageRequestCandidateLean | null;
  requestedByRole: Role;
  requestedByUser: Types.ObjectId | TMarriageRequestUserLean | null;
  status: RishtaMarriageRequestStatus;
  updatedAt?: Date;
}

interface TPairContext {
  candidateIds: string[];
  pairKey: string;
  matchId?: Types.ObjectId;
  conversationId?: Types.ObjectId;
  progress?: IRishtaProgress | null;
};

interface TAutomaticStepInput {
  candidateIds: (Types.ObjectId | string)[];
  completedBy?: string;
  conversationId?: Types.ObjectId | string;
  matchId?: Types.ObjectId | string;
  referenceId?: Types.ObjectId | string;
  source: RishtaProgressStepSource;
  step: Exclude<RishtaProgressStep, RishtaProgressStep.SHAADI>;
};

const assertValidObjectId = (id: string, fieldLabel: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid ${fieldLabel}`);
  }

  return id;
};

const toObjectId = (id: Types.ObjectId | string) =>
  id instanceof Types.ObjectId ? id : new Types.ObjectId(id);

const normalizeCandidateIds = (candidateIds: (Types.ObjectId | string)[]) => {
  const uniqueIds = Array.from(new Set(candidateIds.map((id) => id.toString())));

  if (uniqueIds.length !== 2) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Exactly two different candidates are required'
    );
  }

  return uniqueIds.sort();
};

const buildPairKey = (candidateIds: (Types.ObjectId | string)[]) =>
  normalizeCandidateIds(candidateIds).join('_');

const getProgressValue = (steps: RishtaProgressStep[]) =>
  Math.min(100, steps.length * 25);

const getReferenceId = (params: {
  conversationId?: Types.ObjectId | string;
  matchId?: Types.ObjectId | string;
  referenceId?: Types.ObjectId | string;
}) => params.referenceId ?? params.conversationId ?? params.matchId;

const assertActiveCandidates = async (candidateIds: string[]) => {
  const activeCount = await Candidate.countDocuments({
    _id: { $in: candidateIds.map(toObjectId) },
    isActive: ActiveStatus.ACTIVE,
  });

  if (activeCount !== 2) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'One or both candidate profiles were not found'
    );
  }
};

const resolvePairFromLocator = async (
  locator: IRishtaPairLocator
): Promise<TPairContext> => {
  if (locator.progressId) {
    assertValidObjectId(locator.progressId, 'progress id');
    const progress = await RishtaProgress.findById(locator.progressId);

    if (!progress) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Rishta progress not found');
    }

    const candidateIds = normalizeCandidateIds(progress.candidates);
    await assertActiveCandidates(candidateIds);

    return {
      candidateIds,
      conversationId: progress.conversation,
      matchId: progress.match,
      pairKey: progress.pairKey,
      progress,
    };
  }

  if (locator.matchId) {
    assertValidObjectId(locator.matchId, 'match id');
    const match = await Match.findById(locator.matchId)
      .select('_id candidates conversation')
      .lean<{
        _id: Types.ObjectId;
        candidates: Types.ObjectId[];
        conversation?: Types.ObjectId;
      } | null>();

    if (!match) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Match not found');
    }

    const candidateIds = normalizeCandidateIds(match.candidates);
    await assertActiveCandidates(candidateIds);

    return {
      candidateIds,
      conversationId: match.conversation,
      matchId: match._id,
      pairKey: buildPairKey(candidateIds),
    };
  }

  if (locator.conversationId) {
    assertValidObjectId(locator.conversationId, 'conversation id');
    const conversation = await Conversation.findById(locator.conversationId)
      .select('_id participants match')
      .lean<{
        _id: Types.ObjectId;
        match?: Types.ObjectId;
        participants: Types.ObjectId[];
      } | null>();

    if (!conversation) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Conversation not found');
    }

    const candidateIds = normalizeCandidateIds(conversation.participants);
    await assertActiveCandidates(candidateIds);

    return {
      candidateIds,
      conversationId: conversation._id,
      matchId: conversation.match,
      pairKey: buildPairKey(candidateIds),
    };
  }

  if (locator.candidateId && locator.otherCandidateId) {
    assertValidObjectId(locator.candidateId, 'candidate id');
    assertValidObjectId(locator.otherCandidateId, 'other candidate id');

    const candidateIds = normalizeCandidateIds([
      locator.candidateId,
      locator.otherCandidateId,
    ]);
    await assertActiveCandidates(candidateIds);

    return {
      candidateIds,
      pairKey: buildPairKey(candidateIds),
    };
  }

  throw new AppError(
    StatusCodes.BAD_REQUEST,
    'Provide progressId, matchId, conversationId, or both candidate ids'
  );
};

const candidateBelongsToPair = (candidateId: string, candidateIds: string[]) =>
  candidateIds.includes(candidateId);

const getOrCreateProgress = async (context: TPairContext) => {
  const progress = await RishtaProgress.findOneAndUpdate(
    { pairKey: context.pairKey },
    {
      $set: {
        ...(context.conversationId ? { conversation: context.conversationId } : {}),
        ...(context.matchId ? { match: context.matchId } : {}),
      },
      $setOnInsert: {
        candidates: context.candidateIds.map(toObjectId),
        completedSteps: [],
        pairKey: context.pairKey,
        progressValue: 0,
        status: RishtaProgressStatus.ACTIVE,
        stepDetails: [],
      },
    },
    {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  );

  if (!progress) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to create rishta progress'
    );
  }

  return progress;
};

const addProgressSteps = async (params: {
  completedBy?: string;
  conversationId?: Types.ObjectId | string;
  matchId?: Types.ObjectId | string;
  progress: IRishtaProgress;
  referenceId?: Types.ObjectId | string;
  source: RishtaProgressStepSource;
  steps: RishtaProgressStep[];
}) => {
  const { progress } = params;
  const existingSteps = new Set(progress.completedSteps);
  const now = new Date();
  const referenceId = getReferenceId(params);
  let changed = false;

  for (const step of params.steps) {
    if (existingSteps.has(step)) {
      continue;
    }

    progress.completedSteps.push(step);
    progress.stepDetails.push({
      step,
      completedAt: now,
      source: params.source,
      ...(referenceId ? { referenceId: toObjectId(referenceId) } : {}),
      ...(params.completedBy
        ? { completedBy: new Types.ObjectId(params.completedBy) }
        : {}),
    });
    existingSteps.add(step);
    changed = true;
  }

  if (params.matchId && !progress.match) {
    progress.match = toObjectId(params.matchId);
    changed = true;
  }

  if (params.conversationId && !progress.conversation) {
    progress.conversation = toObjectId(params.conversationId);
    changed = true;
  }

  progress.progressValue = getProgressValue(progress.completedSteps);

  if (changed) {
    await progress.save();
  }

  return progress;
};

const getOwnerAccessForPairOrThrow = async (params: {
  candidateIds: string[];
  preferredCandidateId?: string;
  userId: string;
}) => {
  if (
    params.preferredCandidateId &&
    !candidateBelongsToPair(params.preferredCandidateId, params.candidateIds)
  ) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This candidate does not belong to the rishta pair'
    );
  }

  await syncLegacyOwnerLinks({
    candidateIds: params.candidateIds,
    userId: params.userId,
  });

  const access = await CandidateLinkedUser.findOne({
    accessRole: CandidateLinkedUserAccessRole.OWNER,
    candidate: params.preferredCandidateId
      ? new Types.ObjectId(params.preferredCandidateId)
      : { $in: params.candidateIds.map(toObjectId) },
    status: CandidateLinkedUserStatus.ACTIVE,
    user: new Types.ObjectId(params.userId),
  })
    .select(
      '_id candidate user relationshipToCandidate accessRole status isPrimary linkedBy joinedAt removedAt createdAt updatedAt'
    )
    .lean<TActiveLinkedUserLean | null>();

  if (!access) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only candidate owners can request marriage confirmation'
    );
  }

  return access;
};

const getConsultantAccessForPairOrThrow = async (params: {
  candidateIds: string[];
  userId: string;
}) => {
  const access = await CandidateLinkedUser.findOne({
    candidate: { $in: params.candidateIds.map(toObjectId) },
    relationshipToCandidate: CandidateLinkedUserRelation.CONSULTANT,
    status: CandidateLinkedUserStatus.ACTIVE,
    user: new Types.ObjectId(params.userId),
  })
    .select(
      '_id candidate user relationshipToCandidate accessRole status isPrimary linkedBy joinedAt removedAt createdAt updatedAt'
    )
    .lean<TActiveLinkedUserLean | null>();

  if (!access) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Consultant must be linked to at least one candidate in this rishta'
    );
  }

  return access;
};

const getCandidateOwnerUserIds = async (candidateIds: string[]) => {
  const [linkedOwners, legacyOwners] = await Promise.all([
    CandidateLinkedUser.find({
      accessRole: CandidateLinkedUserAccessRole.OWNER,
      candidate: { $in: candidateIds.map(toObjectId) },
      status: CandidateLinkedUserStatus.ACTIVE,
    })
      .select('user')
      .lean<{ user: Types.ObjectId }[]>(),
    Candidate.find({
      _id: { $in: candidateIds.map(toObjectId) },
      isActive: ActiveStatus.ACTIVE,
    })
      .select('user')
      .lean<{ user: Types.ObjectId }[]>(),
  ]);

  return Array.from(
    new Set([
      ...linkedOwners.map((owner) => owner.user.toString()),
      ...legacyOwners.map((candidate) => candidate.user.toString()),
    ])
  );
};

const getCandidateOwnerUserIdsByCandidate = async (candidateId: string) =>
  getCandidateOwnerUserIds([candidateId]);

const queueNotification = async (params: {
  action: string;
  body: string;
  entityId: Types.ObjectId;
  pairKey: string;
  progressId: Types.ObjectId;
  requestId?: Types.ObjectId;
  title: string;
  userId: string;
  candidateIds: string[];
}) => {
  const requestPath = params.requestId
    ? `/rishta-progress/marriage-requests/${params.requestId.toString()}`
    : `/rishta-progress/${params.progressId.toString()}`;

  try {
    await sendNotificationByBullMQ(
      {
        body: params.body,
        data: {
          action: params.action,
          candidateIds: params.candidateIds,
          pairKey: params.pairKey,
          progressId: params.progressId.toString(),
          ...(params.requestId
            ? { requestId: params.requestId.toString() }
            : {}),
        },
        deepLink: `${env.DEEP_LINK}${requestPath.replace(/^\//, '')}`,
        entityId: params.entityId,
        title: params.title,
        type: NotificationType.MARRIAGE_REQUEST,
        user: new Types.ObjectId(params.userId),
        webUrl: requestPath,
      },
      `rishta_marriage_${params.action}_${params.userId}_${Date.now()}`
    );
  } catch {
    // A notification queue outage must not roll back a marriage workflow action.
  }
};

const notifyUsers = async (params: {
  action: string;
  body: string;
  entityId: Types.ObjectId;
  pairKey: string;
  progressId: Types.ObjectId;
  requestId?: Types.ObjectId;
  title: string;
  userIds: string[];
  candidateIds: string[];
}) => {
  const uniqueUserIds = Array.from(new Set(params.userIds));

  await Promise.all(
    uniqueUserIds.map((userId) =>
      queueNotification({
        ...params,
        userId,
      })
    )
  );
};

const buildProgressResponse = (progress: IRishtaProgress) => ({
  _id: progress._id,
  candidates: progress.candidates,
  completedSteps: progress.completedSteps,
  conversation: progress.conversation,
  consultantUser: progress.consultantUser,
  createdAt: progress.createdAt,
  marriedAt: progress.marriedAt,
  marriageConfirmedBy: progress.marriageConfirmedBy,
  match: progress.match,
  pairKey: progress.pairKey,
  progressValue: progress.progressValue,
  status: progress.status,
  stepDetails: progress.stepDetails,
  updatedAt: progress.updatedAt,
});

const buildMarriageRequestResponse = (request: IRishtaMarriageRequest) => ({
  _id: request._id,
  approvals: request.approvals,
  candidates: request.candidates,
  consultantUser: request.consultantUser,
  createdAt: request.createdAt,
  pairKey: request.pairKey,
  progress: request.progress,
  rejectedAt: request.rejectedAt,
  rejectedByCandidate: request.rejectedByCandidate,
  rejectedByUser: request.rejectedByUser,
  rejectReason: request.rejectReason,
  requestedByCandidate: request.requestedByCandidate,
  requestedByLinkedUser: request.requestedByLinkedUser,
  requestedByRole: request.requestedByRole,
  requestedByUser: request.requestedByUser,
  status: request.status,
  updatedAt: request.updatedAt,
});

const getAgeFromDateOfBirth = (dateOfBirth: Date) => {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }

  return age;
};

const isPopulatedMarriageCandidate = (
  candidate?: Types.ObjectId | TMarriageRequestCandidateLean | null
): candidate is TMarriageRequestCandidateLean =>
  Boolean(
    candidate &&
      typeof candidate === 'object' &&
      'dateOfBirth' in candidate &&
      'name' in candidate
  );

const isPopulatedMarriageRequestUser = (
  user?: Types.ObjectId | TMarriageRequestUserLean | null
): user is TMarriageRequestUserLean =>
  Boolean(
    user &&
      typeof user === 'object' &&
      'full_name' in user &&
      'role' in user
  );

const getMarriageRequestCandidateId = (
  candidate: Types.ObjectId | TMarriageRequestCandidateLean
) => (isPopulatedMarriageCandidate(candidate) ? candidate._id : candidate);

const buildMarriageRequestCandidateCard = (
  candidate: TMarriageRequestCandidateLean
): IRishtaMarriageRequestCandidateCard => ({
  _id: candidate._id,
  age: getAgeFromDateOfBirth(candidate.dateOfBirth),
  gender: candidate.gender,
  images: (candidate.images ?? []).slice(0, 2),
  livesIn: candidate.address?.split(',')[0]?.trim() || undefined,
  name: candidate.name,
  occupation: candidate.occupation,
  religion: candidate.religion,
});

const buildMarriageRequestUserInfo = (
  user: Types.ObjectId | TMarriageRequestUserLean | null
): IRishtaMarriageRequestUserInfo | null => {
  if (!isPopulatedMarriageRequestUser(user)) {
    return null;
  }

  return {
    _id: user._id,
    email: user.email,
    full_name: user.full_name,
    phone: user.phone,
    picture: user.picture,
    role: user.role,
  };
};

const buildMarriageRequestListItem = (
  request: TMarriageRequestListLean,
  currentCandidateId: string
): IRishtaMarriageRequestListItem => {
  const otherCandidate = request.candidates.find(
    (candidate) =>
      getMarriageRequestCandidateId(candidate).toString() !== currentCandidateId
  );
  const currentCandidateApproved = request.approvals.some(
    (approval) => approval.candidate.toString() === currentCandidateId
  );

  return {
    _id: request._id,
    approvals: request.approvals,
    canRespond:
      request.status === RishtaMarriageRequestStatus.PENDING &&
      !currentCandidateApproved,
    candidates: request.candidates.map(getMarriageRequestCandidateId),
    createdAt: request.createdAt,
    currentCandidateApproved,
    otherCandidate: isPopulatedMarriageCandidate(otherCandidate)
      ? buildMarriageRequestCandidateCard(otherCandidate)
      : null,
    pairKey: request.pairKey,
    progress: request.progress,
    requestedByCandidate: isPopulatedMarriageCandidate(
      request.requestedByCandidate
    )
      ? buildMarriageRequestCandidateCard(request.requestedByCandidate)
      : null,
    requestedByRole: request.requestedByRole,
    requestedByUser: buildMarriageRequestUserInfo(request.requestedByUser),
    status: request.status,
    updatedAt: request.updatedAt,
  };
};

const finalizeMarriage = async (params: {
  completedBy: string;
  consultantUser?: Types.ObjectId;
  context: TPairContext;
  source: RishtaProgressStepSource;
  referenceId?: Types.ObjectId;
}) => {
  const progress = await getOrCreateProgress(params.context);

  if (progress.status === RishtaProgressStatus.MARRIED) {
    return progress;
  }

  await addProgressSteps({
    completedBy: params.completedBy,
    conversationId: params.context.conversationId,
    matchId: params.context.matchId,
    progress,
    referenceId: params.referenceId,
    source: params.source,
    steps: PROGRESS_STEPS,
  });

  progress.status = RishtaProgressStatus.MARRIED;
  progress.marriedAt = new Date();
  progress.marriageConfirmedBy = new Types.ObjectId(params.completedBy);

  if (params.consultantUser) {
    progress.consultantUser = params.consultantUser;
  }

  progress.progressValue = 100;
  await progress.save();

  await Promise.all(
    params.context.candidateIds.map((candidateId) =>
      clearSwipeFeedSessionsForCandidate(candidateId)
    )
  );

  return progress;
};

const isRequestFullyApproved = (request: IRishtaMarriageRequest) => {
  const approvedCandidateIds = new Set(
    request.approvals.map((approval) => approval.candidate.toString())
  );

  return request.candidates.every((candidateId) =>
    approvedCandidateIds.has(candidateId.toString())
  );
};

const getProgress = async (userId: string, query: IRishtaProgressQuery) => {
  assertValidObjectId(query.candidateId, 'candidate id');
  await getActiveLinkedUserAccessOrThrow({
    candidateId: query.candidateId,
    userId,
  });

  const context = await resolvePairFromLocator(query);

  if (!candidateBelongsToPair(query.candidateId, context.candidateIds)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This candidate does not belong to the rishta progress'
    );
  }

  const progress = await getOrCreateProgress(context);
  return buildProgressResponse(progress);
};

const completeAutomaticStep = async (params: TAutomaticStepInput) => {
  const candidateIds = normalizeCandidateIds(params.candidateIds);
  const context: TPairContext = {
    candidateIds,
    conversationId: params.conversationId
      ? toObjectId(params.conversationId)
      : undefined,
    matchId: params.matchId ? toObjectId(params.matchId) : undefined,
    pairKey: buildPairKey(candidateIds),
  };
  const progress = await getOrCreateProgress(context);

  return addProgressSteps({
    completedBy: params.completedBy,
    conversationId: params.conversationId,
    matchId: params.matchId,
    progress,
    referenceId: params.referenceId,
    source: params.source,
    steps: [params.step],
  });
};

const getMarriageRequests = async (
  userId: string,
  query: IRishtaMarriageRequestListQuery
): Promise<IRishtaMarriageRequestListResponse> => {
  assertValidObjectId(query.candidateId, 'candidate id');
  await getActiveLinkedUserAccessOrThrow({
    candidateId: query.candidateId,
    requireOwner: true,
    userId,
  });

  const filter: FilterQuery<IRishtaMarriageRequest> = {
    candidates: new Types.ObjectId(query.candidateId),
    ...(query.status ? { status: query.status } : {}),
  };
  const queryBuilder = new QueryBuilder(
    RishtaMarriageRequest.find(filter)
      .populate({
        path: 'requestedByUser',
        select: MARRIAGE_REQUEST_USER_SELECT,
      })
      .populate({
        path: 'requestedByCandidate',
        select: MARRIAGE_REQUEST_CANDIDATE_SELECT,
      })
      .populate({
        path: 'candidates',
        select: MARRIAGE_REQUEST_CANDIDATE_SELECT,
      }),
    {
      limit: String(query.limit),
      page: String(query.page),
      sort: query.sort ?? '-createdAt',
    }
  );

  const [requests, total] = await Promise.all([
    queryBuilder.sort().paginate().build().lean(),
    RishtaMarriageRequest.countDocuments(filter),
  ]);
  const data = (requests as unknown as TMarriageRequestListLean[]).map(
    (request) => buildMarriageRequestListItem(request, query.candidateId)
  );

  return {
    data,
    meta: {
      limit: query.limit,
      page: query.page,
      total,
      totalPage: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};

const createMarriageRequest = async (
  userId: string,
  role: Role,
  payload: ICreateMarriageRequestPayload
 ) => {
  const context = await resolvePairFromLocator(payload);
  const progress = await getOrCreateProgress(context);

  if (progress.status === RishtaProgressStatus.MARRIED) {
    throw new AppError(StatusCodes.CONFLICT, 'This couple is already married');
  }

  const pendingRequest = await RishtaMarriageRequest.exists({
    pairKey: context.pairKey,
    status: RishtaMarriageRequestStatus.PENDING,
  });

  if (pendingRequest) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'A pending marriage request already exists for this couple'
    );
  }

  let requestedByCandidate: Types.ObjectId | undefined;
  let requestedByLinkedUser: Types.ObjectId | undefined;
  let consultantUser: Types.ObjectId | undefined;
  let approvals: IRishtaMarriageRequest['approvals'] = [];
  let notifyCandidateIds = context.candidateIds;

  if (role === Role.USER) {
    const ownerAccess = await getOwnerAccessForPairOrThrow({
      candidateIds: context.candidateIds,
      preferredCandidateId: payload.candidateId,
      userId,
    });
    requestedByCandidate = ownerAccess.candidate;
    requestedByLinkedUser = ownerAccess._id;
    approvals = [
      {
        candidate: ownerAccess.candidate,
        linkedUser: ownerAccess._id,
        respondedAt: new Date(),
        user: new Types.ObjectId(userId),
      },
    ];
    notifyCandidateIds = context.candidateIds.filter(
      (candidateId) => candidateId !== ownerAccess.candidate.toString()
    );
  } else if (role === Role.CONSULTANT) {
    await getConsultantAccessForPairOrThrow({
      candidateIds: context.candidateIds,
      userId,
    });
    consultantUser = new Types.ObjectId(userId);
  } else {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only candidates and consultants can create marriage requests'
    );
  }

  const request = await RishtaMarriageRequest.create({
    approvals,
    candidates: context.candidateIds.map(toObjectId),
    consultantUser,
    pairKey: context.pairKey,
    progress: progress._id,
    requestedByCandidate,
    requestedByLinkedUser,
    requestedByRole: role,
    requestedByUser: new Types.ObjectId(userId),
    status: RishtaMarriageRequestStatus.PENDING,
  });

  const targetUserIds = (
    await Promise.all(notifyCandidateIds.map(getCandidateOwnerUserIdsByCandidate))
  ).flat();

  await notifyUsers({
    action: 'MARRIAGE_REQUEST_CREATED',
    body: 'Please review and confirm the marriage request.',
    candidateIds: context.candidateIds,
    entityId: request._id,
    pairKey: context.pairKey,
    progressId: progress._id,
    requestId: request._id,
    title: 'Marriage confirmation request',
    userIds: targetUserIds.filter((targetUserId) => targetUserId !== userId),
  });

  return buildMarriageRequestResponse(request);
};

const acceptMarriageRequest = async (
  userId: string,
  requestId: string,
  payload: IRespondMarriageRequestPayload
) => {
  assertValidObjectId(requestId, 'marriage request id');
  assertValidObjectId(payload.candidateId, 'candidate id');

  const request = await RishtaMarriageRequest.findOne({
    _id: requestId,
    status: RishtaMarriageRequestStatus.PENDING,
  });

  if (!request) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Pending marriage request not found'
    );
  }

  const candidateIds = normalizeCandidateIds(request.candidates);

  if (!candidateBelongsToPair(payload.candidateId, candidateIds)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This candidate does not belong to the marriage request'
    );
  }

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: payload.candidateId,
    requireOwner: true,
    userId,
  });

  const alreadyApproved = request.approvals.some(
    (approval) => approval.candidate.toString() === payload.candidateId
  );

  if (!alreadyApproved) {
    request.approvals.push({
      candidate: new Types.ObjectId(payload.candidateId),
      linkedUser: access._id,
      respondedAt: new Date(),
      user: new Types.ObjectId(userId),
    });
  }

  let progress = await RishtaProgress.findById(request.progress);

  if (!progress) {
    progress = await getOrCreateProgress({
      candidateIds,
      pairKey: request.pairKey,
    });
    request.progress = progress._id;
  }

  if (isRequestFullyApproved(request)) {
    request.status = RishtaMarriageRequestStatus.ACCEPTED;
    await request.save();

    progress = await finalizeMarriage({
      completedBy: userId,
      consultantUser: request.consultantUser,
      context: {
        candidateIds,
        conversationId: progress.conversation,
        matchId: progress.match,
        pairKey: request.pairKey,
        progress,
      },
      referenceId: request._id,
      source: RishtaProgressStepSource.MARRIAGE_REQUEST_ACCEPTED,
    });

    const ownerUserIds = await getCandidateOwnerUserIds(candidateIds);
    await notifyUsers({
      action: 'MARRIAGE_REQUEST_ACCEPTED',
      body: 'The marriage confirmation has been approved.',
      candidateIds,
      entityId: request._id,
      pairKey: request.pairKey,
      progressId: progress._id,
      requestId: request._id,
      title: 'Marriage confirmed',
      userIds: [
        request.requestedByUser.toString(),
        ...(request.consultantUser ? [request.consultantUser.toString()] : []),
        ...ownerUserIds,
      ],
    });
  } else {
    await request.save();
  }

  return {
    progress: buildProgressResponse(progress),
    request: buildMarriageRequestResponse(request),
  };
};

const rejectMarriageRequest = async (
  userId: string,
  requestId: string,
  payload: IRespondMarriageRequestPayload
) => {
  assertValidObjectId(requestId, 'marriage request id');
  assertValidObjectId(payload.candidateId, 'candidate id');

  const request = await RishtaMarriageRequest.findOne({
    _id: requestId,
    status: RishtaMarriageRequestStatus.PENDING,
  });

  if (!request) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Pending marriage request not found'
    );
  }

  const candidateIds = normalizeCandidateIds(request.candidates);

  if (!candidateBelongsToPair(payload.candidateId, candidateIds)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This candidate does not belong to the marriage request'
    );
  }

  await getActiveLinkedUserAccessOrThrow({
    candidateId: payload.candidateId,
    requireOwner: true,
    userId,
  });

  request.rejectedAt = new Date();
  request.rejectedByCandidate = new Types.ObjectId(payload.candidateId);
  request.rejectedByUser = new Types.ObjectId(userId);
  request.rejectReason = payload.rejectReason?.trim();
  request.status = RishtaMarriageRequestStatus.REJECTED;
  await request.save();

  const ownerUserIds = await getCandidateOwnerUserIds(candidateIds);
  await notifyUsers({
    action: 'MARRIAGE_REQUEST_REJECTED',
    body: 'The marriage confirmation request was rejected.',
    candidateIds,
    entityId: request._id,
    pairKey: request.pairKey,
    progressId: request.progress,
    requestId: request._id,
    title: 'Marriage request rejected',
    userIds: [
      request.requestedByUser.toString(),
      ...(request.consultantUser ? [request.consultantUser.toString()] : []),
      ...ownerUserIds,
    ],
  });

  return buildMarriageRequestResponse(request);
};

const adminMarkMarried = async (
  adminUserId: string,
  payload: IAdminMarkMarriedPayload
) => {
  const context = await resolvePairFromLocator(payload);
  const progress = await finalizeMarriage({
    completedBy: adminUserId,
    context,
    source: RishtaProgressStepSource.ADMIN_CONFIRMED,
  });

  await RishtaMarriageRequest.updateMany(
    {
      pairKey: context.pairKey,
      status: RishtaMarriageRequestStatus.PENDING,
    },
    { $set: { status: RishtaMarriageRequestStatus.CANCELLED } }
  );

  const ownerUserIds = await getCandidateOwnerUserIds(context.candidateIds);
  await notifyUsers({
    action: 'MARRIAGE_ADMIN_CONFIRMED',
    body: 'An admin confirmed this couple as married.',
    candidateIds: context.candidateIds,
    entityId: progress._id,
    pairKey: context.pairKey,
    progressId: progress._id,
    title: 'Marriage confirmed',
    userIds: ownerUserIds,
  });

  return buildProgressResponse(progress);
};

const getMarriedList = async (
  userId: string,
  role: Role,
  query: IMarriedListQuery
) => {
  const filter: Record<string, unknown> = {
    status: RishtaProgressStatus.MARRIED,
  };

  if (role === Role.CONSULTANT) {
    filter.consultantUser = new Types.ObjectId(userId);
  } else if (role !== Role.ADMIN) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only admin and consultants can view married couples'
    );
  }

  const skip = (query.page - 1) * query.limit;
  const [data, total] = await Promise.all([
    RishtaProgress.find(filter)
      .sort({ marriedAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate({
        path: 'candidates',
        select: PROGRESS_CANDIDATE_SELECT,
      })
      .lean(),
    RishtaProgress.countDocuments(filter),
  ]);

  return {
    data,
    meta: {
      limit: query.limit,
      page: query.page,
      total,
      totalPage: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};

export const RishtaProgressService = {
  acceptMarriageRequest,
  adminMarkMarried,
  completeAutomaticStep,
  createMarriageRequest,
  getMarriageRequests,
  getMarriedList,
  getProgress,
  rejectMarriageRequest,
};
