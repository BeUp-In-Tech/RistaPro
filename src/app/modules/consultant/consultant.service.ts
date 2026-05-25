import crypto from 'crypto';
import { RtcRole, RtcTokenBuilder } from 'agora-access-token';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import env from '../../config/env';
import AppError from '../../errorHelpers/AppError';
import { emitChatEvent } from '../../socket/socket';
import { sendNotificationByBullMQ } from '../../utils/backgroundJobProcessingHelper';
import Candidate from '../candidate/candidate.model';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserStatus,
} from '../candidate/linked-user/candidateLinkedUser.interface';
import CandidateLinkedUser from '../candidate/linked-user/candidateLinkedUser.model';
import { NotificationType } from '../notification/notification.interface';
import { PLANS } from '../plan/plan.constant';
import { IPlan, PLAN_KEYS, PlanKey } from '../plan/plan.interface';
import PlanModel from '../plan/plan.model';
import {
  RishtaProgressStatus,
  RishtaProgressStep,
  RishtaProgressStepSource,
  RishtaMarriageRequestStatus,
} from '../rishta_progress/rishta_progress.interface';
import RishtaProgress, {
  RishtaMarriageRequest,
} from '../rishta_progress/rishta_progress.model';
import { clearSwipeFeedSessionsForCandidate } from '../swipe/swipe.helper';
import { ActiveStatus, Role } from '../user/user.interface';
import User from '../user/user.model';
import {
  ConsultantCandidateInviteStatus,
  ConsultantAssignmentStatus,
  ConsultantGuestInviteStatus,
  ConsultantMarriagePartyType,
  ConsultationCaseStatus,
  ConsultationMessageSenderType,
  IAddCaseCandidatePayload,
  IAvailableConsultantsQuery,
  IConsultantAssignmentListQuery,
  IConsultantGuestInvite,
  IConsultantMarriageRecordListQuery,
  IConsultationCase,
  IConsultationCaseListQuery,
  IConsultationMessagesQuery,
  ICreateConsultantAssignmentPayload,
  ICreateCandidateInvitePayload,
  ICreateConsultantMarriageRecordPayload,
  ICreateConsultationCasePayload,
  ICreateGuestInvitePayload,
  IStartConsultationCasePayload,
  ISendConsultationMessagePayload,
} from './consultant.interface';
import {
  ConsultantAssignment,
  ConsultantCandidateInvite,
  ConsultantGuestInvite,
  ConsultantMarriageRecord,
  ConsultationCase,
  ConsultationMessage,
} from './consultant.model';

const GUEST_INVITE_DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CONSULTANT_PROGRESS_STEPS = [
  RishtaProgressStep.MATCHES,
  RishtaProgressStep.START_CHAT,
  RishtaProgressStep.PARENT_INVOLVES,
  RishtaProgressStep.SHAADI,
];

interface TCandidateAccess {
  _id?: Types.ObjectId;
  accessRole: CandidateLinkedUserAccessRole;
  candidate: Types.ObjectId;
  user: Types.ObjectId;
}

interface TGuestInviteContext {
  consultationCase: IConsultationCase;
  invite: IConsultantGuestInvite;
}

interface TConsultantUser {
  _id: Types.ObjectId;
  email: string;
  full_name: string;
  picture?: string;
  role?: Role;
}

const assertValidObjectId = (value: string, label: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid ${label}`);
  }
};

const getPlanKeyOrDefault = (plan?: string): PlanKey =>
  PLAN_KEYS.includes(plan as PlanKey) ? (plan as PlanKey) : 'free';

const getCandidatePlanOrThrow = async (candidateId: string) => {
  const candidate = await Candidate.findById(candidateId)
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
    } | null>();

  if (!candidate || candidate.isActive !== ActiveStatus.ACTIVE) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
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

const assertCandidateCanUseConsultant = async (candidateId: string) => {
  const plan = await getCandidatePlanOrThrow(candidateId);

  if (!plan.canUseConsultant) {
    throw new AppError(
      StatusCodes.PAYMENT_REQUIRED,
      'Consultant features are available on the platinum plan'
    );
  }

  return plan;
};

const getCandidateAccessOrThrow = async (params: {
  candidateId: string;
  userId: string;
}) => {
  const linkedAccess = await CandidateLinkedUser.findOne({
    candidate: new Types.ObjectId(params.candidateId),
    status: CandidateLinkedUserStatus.ACTIVE,
    user: new Types.ObjectId(params.userId),
  })
    .select('_id candidate user accessRole')
    .lean<TCandidateAccess | null>();

  if (linkedAccess) {
    return linkedAccess;
  }

  const legacyCandidate = await Candidate.findOne({
    _id: new Types.ObjectId(params.candidateId),
    isActive: ActiveStatus.ACTIVE,
    user: new Types.ObjectId(params.userId),
  })
    .select('_id user')
    .lean<{ _id: Types.ObjectId; user: Types.ObjectId } | null>();

  if (legacyCandidate) {
    return {
      accessRole: CandidateLinkedUserAccessRole.OWNER,
      candidate: legacyCandidate._id,
      user: legacyCandidate.user,
    };
  }

  throw new AppError(
    StatusCodes.FORBIDDEN,
    'You are not linked with this candidate profile'
  );
};

const assertWritableAccess = (access: TCandidateAccess) => {
  if (access.accessRole === CandidateLinkedUserAccessRole.VIEWER) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Viewer access cannot perform this consultant action'
    );
  }
};

const assertActiveConsultant = async (consultantId: string) => {
  const consultant = await User.findOne({
    _id: new Types.ObjectId(consultantId),
    isActive: ActiveStatus.ACTIVE,
    isDeleted: false,
    role: Role.CONSULTANT,
  })
    .select('_id full_name email')
    .lean<{ _id: Types.ObjectId; email: string; full_name: string } | null>();

  if (!consultant) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Consultant not found');
  }

  return consultant;
};

const assertActiveCandidate = async (candidateId: string) => {
  const candidate = await Candidate.findOne({
    _id: new Types.ObjectId(candidateId),
    isActive: ActiveStatus.ACTIVE,
  })
    .select('_id name user')
    .lean<{ _id: Types.ObjectId; name: string; user: Types.ObjectId } | null>();

  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  return candidate;
};

const assertConsultantAssignment = async (params: {
  candidateId: string;
  consultantId: string;
}) => {
  const assignment = await ConsultantAssignment.exists({
    candidate: new Types.ObjectId(params.candidateId),
    consultant: new Types.ObjectId(params.consultantId),
    status: ConsultantAssignmentStatus.ACTIVE,
  });

  if (!assignment) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Consultant is not assigned to this candidate'
    );
  }
};

const ensureConsultantAssignment = async (params: {
  assignedByUserId: string;
  candidateId: string;
  consultantId: string;
  note?: string;
}) =>
  ConsultantAssignment.findOneAndUpdate(
    {
      candidate: new Types.ObjectId(params.candidateId),
      consultant: new Types.ObjectId(params.consultantId),
      status: ConsultantAssignmentStatus.ACTIVE,
    },
    {
      $set: {
        assignedBy: new Types.ObjectId(params.assignedByUserId),
        ...(params.note ? { note: params.note.trim() } : {}),
      },
      $setOnInsert: {
        candidate: new Types.ObjectId(params.candidateId),
        consultant: new Types.ObjectId(params.consultantId),
        status: ConsultantAssignmentStatus.ACTIVE,
      },
    },
    {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  );

const getPrimaryCandidateId = (consultationCase: IConsultationCase) =>
  consultationCase.primaryCandidate?.toString() ??
  consultationCase.candidates[0]?.toString();

const isPrimaryCaseCandidate = (
  consultationCase: IConsultationCase,
  candidateId: string
) => getPrimaryCandidateId(consultationCase) === candidateId;

const getWritableCandidateRecipients = async (candidateId: string) => {
  const [linkedUsers, legacyCandidate] = await Promise.all([
    CandidateLinkedUser.find({
      accessRole: {
        $in: [
          CandidateLinkedUserAccessRole.OWNER,
          CandidateLinkedUserAccessRole.EDITOR,
        ],
      },
      candidate: new Types.ObjectId(candidateId),
      status: CandidateLinkedUserStatus.ACTIVE,
    })
      .populate({
        path: 'user',
        select: '_id full_name email',
      })
      .select('user')
      .lean<
        {
          user: TConsultantUser | Types.ObjectId | null;
        }[]
      >(),
    Candidate.findOne({
      _id: new Types.ObjectId(candidateId),
      isActive: ActiveStatus.ACTIVE,
    })
      .populate({
        path: 'user',
        select: '_id full_name email',
      })
      .select('user')
      .lean<{ user: TConsultantUser | Types.ObjectId | null } | null>(),
  ]);

  const recipients = linkedUsers.flatMap((linkedUser) => {
    if (
      linkedUser.user &&
      typeof linkedUser.user === 'object' &&
      'email' in linkedUser.user
    ) {
      return [linkedUser.user];
    }

    return [];
  });

  if (
    legacyCandidate?.user &&
    typeof legacyCandidate.user === 'object' &&
    'email' in legacyCandidate.user
  ) {
    recipients.push(legacyCandidate.user);
  }

  return recipients.filter(
    (recipient, index, allRecipients) =>
      allRecipients.findIndex(
        (item) => item._id.toString() === recipient._id.toString()
      ) === index
  );
};

const getCaseAudienceUserIds = async (consultationCase: IConsultationCase) => {
  const candidateIds = consultationCase.candidates.map(
    (candidateId) => new Types.ObjectId(candidateId)
  );

  const [linkedUsers, legacyCandidates] = await Promise.all([
    CandidateLinkedUser.find({
      candidate: { $in: candidateIds },
      status: CandidateLinkedUserStatus.ACTIVE,
    })
      .select('user')
      .lean<{ user: Types.ObjectId }[]>(),
    Candidate.find({
      _id: { $in: candidateIds },
      isActive: ActiveStatus.ACTIVE,
    })
      .select('user')
      .lean<{ user: Types.ObjectId }[]>(),
  ]);

  return Array.from(
    new Set([
      consultationCase.consultant.toString(),
      ...linkedUsers.map((linkedUser) => linkedUser.user.toString()),
      ...legacyCandidates.map((candidate) => candidate.user.toString()),
    ])
  );
};

const getReadableCaseForUser = async (params: {
  caseId: string;
  role: Role;
  userId: string;
}) => {
  assertValidObjectId(params.caseId, 'case id');

  const consultationCase = await ConsultationCase.findById(params.caseId);

  if (!consultationCase) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Consultation case not found');
  }

  if (params.role === Role.CONSULTANT) {
    if (consultationCase.consultant.toString() !== params.userId) {
      throw new AppError(StatusCodes.FORBIDDEN, 'You cannot access this case');
    }

    return consultationCase;
  }

  if (params.role !== Role.USER) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You cannot access this case');
  }

  const access = await CandidateLinkedUser.findOne({
    candidate: { $in: consultationCase.candidates },
    status: CandidateLinkedUserStatus.ACTIVE,
    user: new Types.ObjectId(params.userId),
  })
    .select('_id candidate user accessRole')
    .lean<TCandidateAccess | null>();

  let candidateId = access?.candidate?.toString();

  if (!candidateId) {
    const legacyCandidate = await Candidate.findOne({
      _id: { $in: consultationCase.candidates },
      isActive: ActiveStatus.ACTIVE,
      user: new Types.ObjectId(params.userId),
    })
      .select('_id')
      .lean<{ _id: Types.ObjectId } | null>();

    candidateId = legacyCandidate?._id.toString();
  }

  if (!candidateId) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You cannot access this case');
  }

  if (isPrimaryCaseCandidate(consultationCase, candidateId)) {
    await assertCandidateCanUseConsultant(candidateId);
  }

  return consultationCase;
};

const getWritableCaseForCandidateUser = async (params: {
  candidateId?: string;
  caseId: string;
  userId: string;
}) => {
  if (!params.candidateId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Candidate id is required');
  }

  assertValidObjectId(params.candidateId, 'candidate id');
  const consultationCase = await ConsultationCase.findById(params.caseId);

  if (!consultationCase) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Consultation case not found');
  }

  if (consultationCase.status !== ConsultationCaseStatus.OPEN) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Only open consultation cases can be used'
    );
  }

  const isCandidateInCase = consultationCase.candidates.some(
    (candidateId) => candidateId.toString() === params.candidateId
  );

  if (!isCandidateInCase) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This candidate does not belong to the consultation case'
    );
  }

  const access = await getCandidateAccessOrThrow({
    candidateId: params.candidateId,
    userId: params.userId,
  });
  assertWritableAccess(access);

  if (isPrimaryCaseCandidate(consultationCase, params.candidateId)) {
    await assertCandidateCanUseConsultant(params.candidateId);
  }

  return { access, consultationCase };
};

const hashGuestToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

const getGuestInviteContext = async (token: string): Promise<TGuestInviteContext> => {
  const invite = await ConsultantGuestInvite.findOne({
    status: ConsultantGuestInviteStatus.ACTIVE,
    tokenHash: hashGuestToken(token),
  });

  if (!invite || invite.expiresAt.getTime() <= Date.now()) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Guest invite not found or expired');
  }

  const consultationCase = await ConsultationCase.findById(invite.case);

  if (!consultationCase || consultationCase.status !== ConsultationCaseStatus.OPEN) {
    throw new AppError(StatusCodes.CONFLICT, 'Consultation case is not open');
  }

  const alreadyJoined = consultationCase.guestParticipants.some(
    (participant) => participant.guestInvite.toString() === invite._id.toString()
  );

  if (!alreadyJoined) {
    consultationCase.guestParticipants.push({
      contact: invite.contact,
      displayName: invite.displayName,
      guestInvite: invite._id,
      joinedAt: new Date(),
    });
    await consultationCase.save();
  }

  invite.lastUsedAt = new Date();
  await invite.save();

  return { consultationCase, invite };
};

const getNextAgoraUid = (usedUids: Set<number>) => {
  let uid = Math.floor(Math.random() * 2147483000) + 1;

  while (usedUids.has(uid)) {
    uid = Math.floor(Math.random() * 2147483000) + 1;
  }

  return uid;
};

const getAgoraToken = (params: { channelName: string; uid: number }) => {
  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Agora credentials are not configured'
    );
  }

  const tokenTtlSeconds = Number.isFinite(env.AGORA_TOKEN_TTL_SECONDS)
    ? Math.min(Math.max(env.AGORA_TOKEN_TTL_SECONDS, 60), 86400)
    : 3600;
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + tokenTtlSeconds;

  return {
    appId: env.AGORA_APP_ID,
    channelName: params.channelName,
    expiresAt: new Date(expiresAtSeconds * 1000),
    token: RtcTokenBuilder.buildTokenWithUid(
      env.AGORA_APP_ID,
      env.AGORA_APP_CERTIFICATE,
      params.channelName,
      params.uid,
      RtcRole.PUBLISHER,
      expiresAtSeconds
    ),
    uid: params.uid,
  };
};

const getAvailableConsultants = async (
  userId: string,
  query: IAvailableConsultantsQuery
) => {
  assertValidObjectId(query.candidateId, 'candidate id');

  const access = await getCandidateAccessOrThrow({
    candidateId: query.candidateId,
    userId,
  });
  assertWritableAccess(access);
  await assertCandidateCanUseConsultant(query.candidateId);

  return User.find({
    isActive: ActiveStatus.ACTIVE,
    isDeleted: false,
    role: Role.CONSULTANT,
  })
    .select('_id full_name email picture isVerified role createdAt')
    .sort({ full_name: 1 })
    .lean();
};

const ensureCandidateConsultationCase = async (
  userId: string,
  payload: IStartConsultationCasePayload
) => {
  assertValidObjectId(payload.candidateId, 'candidate id');
  assertValidObjectId(payload.consultantId, 'consultant id');

  const [access] = await Promise.all([
    getCandidateAccessOrThrow({
      candidateId: payload.candidateId,
      userId,
    }),
    assertActiveConsultant(payload.consultantId),
    assertActiveCandidate(payload.candidateId),
    assertCandidateCanUseConsultant(payload.candidateId),
  ]);
  assertWritableAccess(access);

  await ensureConsultantAssignment({
    assignedByUserId: payload.consultantId,
    candidateId: payload.candidateId,
    consultantId: payload.consultantId,
    note: 'Candidate selected consultant',
  });

  const candidateObjectId = new Types.ObjectId(payload.candidateId);
  const consultantObjectId = new Types.ObjectId(payload.consultantId);
  let consultationCase = await ConsultationCase.findOne({
    consultant: consultantObjectId,
    status: ConsultationCaseStatus.OPEN,
    $or: [
      { primaryCandidate: candidateObjectId },
      {
        candidates: candidateObjectId,
        primaryCandidate: { $exists: false },
      },
    ],
  });

  if (!consultationCase) {
    consultationCase = await ConsultationCase.create({
      candidates: [candidateObjectId],
      consultant: consultantObjectId,
      createdBy: new Types.ObjectId(userId),
      note: payload.note?.trim(),
      primaryCandidate: candidateObjectId,
      status: ConsultationCaseStatus.OPEN,
      title: payload.title?.trim(),
    });
  } else if (!consultationCase.primaryCandidate) {
    consultationCase.primaryCandidate = candidateObjectId;
    await consultationCase.save();
  }

  return consultationCase.populate({
    path: 'candidates',
    select: '_id name gender images address',
  });
};

const startConsultationCase = async (
  userId: string,
  payload: IStartConsultationCasePayload
) => ensureCandidateConsultationCase(userId, payload);

const createConsultationCase = async (
  userId: string,
  payload: ICreateConsultationCasePayload
) => {
  await assertActiveConsultant(userId);

  const candidateIds = Array.from(new Set(payload.candidateIds));

  if (!candidateIds.length || candidateIds.length > 2) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'A consultation case requires one or two candidates'
    );
  }

  await Promise.all(
    candidateIds.map(async (candidateId) => {
      assertValidObjectId(candidateId, 'candidate id');
      await assertActiveCandidate(candidateId);
      await assertConsultantAssignment({
        candidateId,
        consultantId: userId,
      });
    })
  );

  return ConsultationCase.create({
    candidates: candidateIds.map((candidateId) => new Types.ObjectId(candidateId)),
    consultant: new Types.ObjectId(userId),
    createdBy: new Types.ObjectId(userId),
    note: payload.note?.trim(),
    primaryCandidate: new Types.ObjectId(candidateIds[0] as string),
    status: ConsultationCaseStatus.OPEN,
    title: payload.title?.trim(),
  });
};

const getConsultationCases = async (
  userId: string,
  role: Role,
  query: IConsultationCaseListQuery
) => {
  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (role === Role.CONSULTANT) {
    filter.consultant = new Types.ObjectId(userId);
  } else if (role === Role.USER) {
    if (!query.candidateId) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Candidate id is required');
    }

    assertValidObjectId(query.candidateId, 'candidate id');
    await getCandidateAccessOrThrow({
      candidateId: query.candidateId,
      userId,
    });
    filter.candidates = new Types.ObjectId(query.candidateId);
  } else {
    throw new AppError(StatusCodes.FORBIDDEN, 'You cannot view cases');
  }

  return ConsultationCase.find(filter)
    .populate({ path: 'candidates', select: '_id name gender images address' })
    .sort({ updatedAt: -1 })
    .lean();
};

const getConsultationCase = async (userId: string, role: Role, caseId: string) => {
  const consultationCase = await getReadableCaseForUser({ caseId, role, userId });
  return consultationCase.populate({
    path: 'candidates',
    select: '_id name gender images address',
  });
};

const addCandidateToCase = async (
  userId: string,
  caseId: string,
  payload: IAddCaseCandidatePayload
) => {
  assertValidObjectId(caseId, 'case id');
  assertValidObjectId(payload.candidateId, 'candidate id');

  const consultationCase = await ConsultationCase.findById(caseId);

  if (!consultationCase) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Consultation case not found');
  }

  if (consultationCase.consultant.toString() !== userId) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You cannot update this case');
  }

  if (consultationCase.status !== ConsultationCaseStatus.OPEN) {
    throw new AppError(StatusCodes.CONFLICT, 'Only open cases can be updated');
  }

  if (consultationCase.candidates.length >= 2) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'A consultation case can have at most two candidates'
    );
  }

  const alreadyInCase = consultationCase.candidates.some(
    (candidateId) => candidateId.toString() === payload.candidateId
  );

  if (alreadyInCase) {
    throw new AppError(StatusCodes.CONFLICT, 'Candidate is already in this case');
  }

  await assertActiveCandidate(payload.candidateId);
  await assertConsultantAssignment({
    candidateId: payload.candidateId,
    consultantId: userId,
  });

  consultationCase.candidates.push(new Types.ObjectId(payload.candidateId));
  await consultationCase.save();

  return consultationCase;
};

const createCandidateInvite = async (
  userId: string,
  caseId: string,
  payload: ICreateCandidateInvitePayload
) => {
  assertValidObjectId(caseId, 'case id');
  assertValidObjectId(payload.candidateId, 'candidate id');

  const consultationCase = await ConsultationCase.findById(caseId);

  if (!consultationCase) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Consultation case not found');
  }

  if (consultationCase.consultant.toString() !== userId) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You cannot invite candidates to this case'
    );
  }

  if (consultationCase.status !== ConsultationCaseStatus.OPEN) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Only open cases can receive candidate invites'
    );
  }

  if (consultationCase.candidates.length >= 2) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'A consultation case can have at most two candidates'
    );
  }

  const alreadyInCase = consultationCase.candidates.some(
    (candidateId) => candidateId.toString() === payload.candidateId
  );

  if (alreadyInCase) {
    throw new AppError(StatusCodes.CONFLICT, 'Candidate is already in this case');
  }

  await assertActiveCandidate(payload.candidateId);

  const invite = await ConsultantCandidateInvite.findOneAndUpdate(
    {
      candidate: new Types.ObjectId(payload.candidateId),
      case: consultationCase._id,
      status: ConsultantCandidateInviteStatus.PENDING,
    },
    {
      $setOnInsert: {
        candidate: new Types.ObjectId(payload.candidateId),
        case: consultationCase._id,
        consultant: consultationCase.consultant,
        invitedBy: new Types.ObjectId(userId),
        status: ConsultantCandidateInviteStatus.PENDING,
      },
    },
    {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  );

  const recipients = await getWritableCandidateRecipients(payload.candidateId);

  void Promise.all(
    recipients.map((recipient) =>
      sendNotificationByBullMQ(
        {
          body: 'A consultant invited your profile to join a consultation case.',
          data: {
            action: 'CONSULTANT_CANDIDATE_INVITED',
            candidateId: payload.candidateId,
            caseId: consultationCase._id.toString(),
            inviteId: invite._id.toString(),
          },
          deepLink: `${env.DEEP_LINK}consultant/candidate-invites/${invite._id.toString()}`,
          entityId: invite._id,
          title: 'Consultant case invitation',
          type: NotificationType.SYSTEM,
          user: recipient._id,
          webUrl: `/consultant/candidate-invites/${invite._id.toString()}`,
        },
        `consultant_candidate_invited_${invite._id.toString()}_${recipient._id.toString()}`
      )
    )
  ).catch(() => undefined);

  return invite;
};

const getActionableCandidateInvite = async (params: {
  inviteId: string;
  userId: string;
}) => {
  assertValidObjectId(params.inviteId, 'candidate invite id');

  const invite = await ConsultantCandidateInvite.findById(params.inviteId);

  if (!invite) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate invite not found');
  }

  if (invite.status !== ConsultantCandidateInviteStatus.PENDING) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This candidate invite has already been handled'
    );
  }

  const consultationCase = await ConsultationCase.findById(invite.case);

  if (!consultationCase) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Consultation case not found');
  }

  if (consultationCase.status !== ConsultationCaseStatus.OPEN) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Only open consultation cases can accept invites'
    );
  }

  const access = await getCandidateAccessOrThrow({
    candidateId: invite.candidate.toString(),
    userId: params.userId,
  });
  assertWritableAccess(access);

  return { access, consultationCase, invite };
};

const acceptCandidateInvite = async (userId: string, inviteId: string) => {
  const { consultationCase, invite } = await getActionableCandidateInvite({
    inviteId,
    userId,
  });
  const invitedCandidateId = invite.candidate.toString();
  const alreadyInCase = consultationCase.candidates.some(
    (candidateId) => candidateId.toString() === invitedCandidateId
  );

  if (!alreadyInCase && consultationCase.candidates.length >= 2) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'A consultation case can have at most two candidates'
    );
  }

  await ensureConsultantAssignment({
    assignedByUserId: consultationCase.consultant.toString(),
    candidateId: invitedCandidateId,
    consultantId: consultationCase.consultant.toString(),
    note: 'Candidate accepted consultant case invite',
  });

  if (!alreadyInCase) {
    consultationCase.candidates.push(invite.candidate);
    await consultationCase.save();
  }

  invite.respondedAt = new Date();
  invite.respondedBy = new Types.ObjectId(userId);
  invite.status = ConsultantCandidateInviteStatus.ACCEPTED;
  await invite.save();

  void sendNotificationByBullMQ(
    {
      body: 'A candidate accepted your consultant case invitation.',
      data: {
        action: 'CONSULTANT_CANDIDATE_INVITE_ACCEPTED',
        caseId: consultationCase._id.toString(),
        inviteId: invite._id.toString(),
      },
      deepLink: `${env.DEEP_LINK}consultant/cases/${consultationCase._id.toString()}`,
      entityId: invite._id,
      title: 'Candidate invite accepted',
      type: NotificationType.SYSTEM,
      user: consultationCase.consultant,
      webUrl: `/consultant/cases/${consultationCase._id.toString()}`,
    },
    `consultant_candidate_invite_accepted_${invite._id.toString()}`
  ).catch(() => undefined);

  return {
    case: consultationCase.toObject(),
    invite: invite.toObject(),
  };
};

const declineCandidateInvite = async (userId: string, inviteId: string) => {
  const { consultationCase, invite } = await getActionableCandidateInvite({
    inviteId,
    userId,
  });

  invite.respondedAt = new Date();
  invite.respondedBy = new Types.ObjectId(userId);
  invite.status = ConsultantCandidateInviteStatus.DECLINED;
  await invite.save();

  void sendNotificationByBullMQ(
    {
      body: 'A candidate declined your consultant case invitation.',
      data: {
        action: 'CONSULTANT_CANDIDATE_INVITE_DECLINED',
        caseId: consultationCase._id.toString(),
        inviteId: invite._id.toString(),
      },
      deepLink: `${env.DEEP_LINK}consultant/cases/${consultationCase._id.toString()}`,
      entityId: invite._id,
      title: 'Candidate invite declined',
      type: NotificationType.SYSTEM,
      user: consultationCase.consultant,
      webUrl: `/consultant/cases/${consultationCase._id.toString()}`,
    },
    `consultant_candidate_invite_declined_${invite._id.toString()}`
  ).catch(() => undefined);

  return invite.toObject();
};

const sendConsultationMessage = async (
  userId: string,
  role: Role,
  caseId: string,
  payload: ISendConsultationMessagePayload
) => {
  assertValidObjectId(caseId, 'case id');

  let consultationCase: IConsultationCase;
  let messagePayload: Record<string, unknown>;

  if (role === Role.CONSULTANT) {
    consultationCase = await ConsultationCase.findById(caseId) as IConsultationCase;

    if (!consultationCase) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Consultation case not found');
    }

    if (consultationCase.consultant.toString() !== userId) {
      throw new AppError(StatusCodes.FORBIDDEN, 'You cannot message in this case');
    }

    if (consultationCase.status !== ConsultationCaseStatus.OPEN) {
      throw new AppError(StatusCodes.CONFLICT, 'Only open cases can be messaged');
    }

    messagePayload = {
      senderType: ConsultationMessageSenderType.CONSULTANT,
      senderUser: new Types.ObjectId(userId),
    };
  } else if (role === Role.USER) {
    const writableContext = await getWritableCaseForCandidateUser({
      candidateId: payload.candidateId,
      caseId,
      userId,
    });
    consultationCase = writableContext.consultationCase;
    messagePayload = {
      senderCandidate: new Types.ObjectId(payload.candidateId),
      senderLinkedUser: writableContext.access._id,
      senderType: ConsultationMessageSenderType.CANDIDATE_USER,
      senderUser: new Types.ObjectId(userId),
    };
  } else {
    throw new AppError(StatusCodes.FORBIDDEN, 'You cannot message in this case');
  }

  const message = await ConsultationMessage.create({
    case: consultationCase._id,
    message: payload.message.trim(),
    seenByUsers: role === Role.USER || role === Role.CONSULTANT
      ? [new Types.ObjectId(userId)]
      : [],
    ...messagePayload,
  });

  consultationCase.lastMessage = message._id;
  await consultationCase.save();

  const savedMessage = await ConsultationMessage.findById(message._id).lean();
  const audienceUserIds = await getCaseAudienceUserIds(consultationCase);

  emitChatEvent({
    event: 'consultant:message:new',
    payload: {
      caseId,
      message: savedMessage,
    },
    userIds: audienceUserIds,
  });

  return savedMessage;
};

const getConsultationMessages = async (
  userId: string,
  role: Role,
  caseId: string,
  query: IConsultationMessagesQuery
) => {
  await getReadableCaseForUser({ caseId, role, userId });

  const page = query.page ?? 1;
  const limit = query.limit ?? 30;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    ConsultationMessage.find({ case: new Types.ObjectId(caseId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ConsultationMessage.countDocuments({ case: new Types.ObjectId(caseId) }),
  ]);

  return {
    data,
    meta: {
      limit,
      page,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

const createGuestInvite = async (
  userId: string,
  caseId: string,
  payload: ICreateGuestInvitePayload
) => {
  assertValidObjectId(caseId, 'case id');

  const consultationCase = await ConsultationCase.findById(caseId);

  if (!consultationCase) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Consultation case not found');
  }

  if (consultationCase.consultant.toString() !== userId) {
    throw new AppError(StatusCodes.FORBIDDEN, 'You cannot invite guests to this case');
  }

  if (consultationCase.status !== ConsultationCaseStatus.OPEN) {
    throw new AppError(StatusCodes.CONFLICT, 'Only open cases can receive guests');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const invite = await ConsultantGuestInvite.create({
    case: consultationCase._id,
    consultant: consultationCase.consultant,
    contact: payload.contact?.trim(),
    createdBy: new Types.ObjectId(userId),
    displayName: payload.displayName.trim(),
    expiresAt: payload.expiresAt ?? new Date(Date.now() + GUEST_INVITE_DEFAULT_TTL_MS),
    status: ConsultantGuestInviteStatus.ACTIVE,
    tokenHash: hashGuestToken(token),
  });

  return {
    invite: {
      _id: invite._id,
      case: invite.case,
      contact: invite.contact,
      displayName: invite.displayName,
      expiresAt: invite.expiresAt,
      status: invite.status,
    },
    token,
    url: `${env.FRONTEND_URL}/consultant/guest-invites/${token}`,
  };
};

const getGuestInvite = async (token: string) => {
  const { consultationCase, invite } = await getGuestInviteContext(token);

  return {
    case: {
      _id: consultationCase._id,
      candidates: consultationCase.candidates,
      status: consultationCase.status,
      title: consultationCase.title,
    },
    invite: {
      _id: invite?._id,
      contact: invite?.contact,
      displayName: invite?.displayName,
      expiresAt: invite?.expiresAt,
      status: invite?.status,
    },
  };
};

const getGuestInviteMeetingContext = async (token: string) =>
  getGuestInviteContext(token);

const sendGuestMessage = async (
  token: string,
  payload: ISendConsultationMessagePayload
) => {
  const { consultationCase, invite } = await getGuestInviteContext(token);

  if (!invite) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Guest invite not found');
  }

  const message = await ConsultationMessage.create({
    case: consultationCase._id,
    guestDisplayName: invite.displayName,
    guestInvite: invite._id,
    message: payload.message.trim(),
    seenByUsers: [],
    senderType: ConsultationMessageSenderType.GUEST,
  });

  consultationCase.lastMessage = message._id;
  await consultationCase.save();

  const savedMessage = await ConsultationMessage.findById(message._id).lean();
  const audienceUserIds = await getCaseAudienceUserIds(consultationCase);

  emitChatEvent({
    event: 'consultant:message:new',
    payload: {
      caseId: consultationCase._id,
      message: savedMessage,
    },
    userIds: audienceUserIds,
  });

  return savedMessage;
};

const getGuestMessages = async (
  token: string,
  query: IConsultationMessagesQuery
) => {
  const { consultationCase } = await getGuestInviteContext(token);
  const page = query.page ?? 1;
  const limit = query.limit ?? 30;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    ConsultationMessage.find({ case: consultationCase._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ConsultationMessage.countDocuments({ case: consultationCase._id }),
  ]);

  return {
    data,
    meta: {
      limit,
      page,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

const createConsultantMarriageRecord = async (
  userId: string,
  payload: ICreateConsultantMarriageRecordPayload
) => {
  await assertActiveConsultant(userId);

  let consultationCase: IConsultationCase | null = null;

  if (payload.caseId) {
    assertValidObjectId(payload.caseId, 'case id');
    consultationCase = await ConsultationCase.findById(payload.caseId);

    if (!consultationCase) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Consultation case not found');
    }

    if (consultationCase.consultant.toString() !== userId) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        'You cannot create marriage records for this case'
      );
    }
  }

  const parties = [];

  for (const party of payload.parties) {
    if (party.partyType === ConsultantMarriagePartyType.CANDIDATE) {
      if (!party.candidateId) {
        throw new AppError(StatusCodes.BAD_REQUEST, 'Candidate id is required');
      }

      assertValidObjectId(party.candidateId, 'candidate id');
      const candidate = await assertActiveCandidate(party.candidateId);

      if (consultationCase) {
        const candidateInCase = consultationCase.candidates.some(
          (candidateId) => candidateId.toString() === party.candidateId
        );

        if (!candidateInCase) {
          throw new AppError(
            StatusCodes.FORBIDDEN,
            'Candidate does not belong to this consultation case'
          );
        }
      } else {
        await assertConsultantAssignment({
          candidateId: party.candidateId,
          consultantId: userId,
        });
      }

      parties.push({
        candidate: candidate._id,
        displayName: candidate.name,
        partyType: ConsultantMarriagePartyType.CANDIDATE,
      });
    } else {
      let displayName = party.displayName?.trim();
      let contact = party.contact?.trim();
      let guestInviteId: Types.ObjectId | undefined;

      if (party.guestInviteId) {
        assertValidObjectId(party.guestInviteId, 'guest invite id');
        const invite = await ConsultantGuestInvite.findOne({
          _id: new Types.ObjectId(party.guestInviteId),
          ...(consultationCase ? { case: consultationCase._id } : {}),
          consultant: new Types.ObjectId(userId),
        }).lean<IConsultantGuestInvite | null>();

        if (!invite) {
          throw new AppError(StatusCodes.NOT_FOUND, 'Guest invite not found');
        }

        displayName = invite.displayName;
        contact = invite.contact;
        guestInviteId = invite._id;
      }

      if (!displayName) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          'Guest display name is required'
        );
      }

      parties.push({
        contact,
        displayName,
        guestInvite: guestInviteId,
        partyType: ConsultantMarriagePartyType.GUEST,
      });
    }
  }

  const candidateParties = parties.filter(
    (party) => party.partyType === ConsultantMarriagePartyType.CANDIDATE
  );

  if (
    candidateParties.length === 2 &&
    candidateParties[0].candidate?.toString() ===
      candidateParties[1].candidate?.toString()
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Two different candidates are required'
    );
  }

  const marriageRecord = await ConsultantMarriageRecord.create({
    case: consultationCase?._id,
    consultant: new Types.ObjectId(userId),
    createdBy: new Types.ObjectId(userId),
    marriedAt: payload.marriedAt ?? new Date(),
    note: payload.note?.trim(),
    parties,
  });

  if (candidateParties.length === 2) {
    const candidateIds = candidateParties
      .map((party) => party.candidate?.toString())
      .filter(Boolean) as string[];
    const pairKey = Array.from(new Set(candidateIds)).sort().join('_');
    const progress = await RishtaProgress.findOneAndUpdate(
      { pairKey },
      {
        $set: {
          consultantUser: new Types.ObjectId(userId),
          marriageConfirmedBy: new Types.ObjectId(userId),
          marriedAt: payload.marriedAt ?? new Date(),
          progressValue: 100,
          status: RishtaProgressStatus.MARRIED,
        },
        $setOnInsert: {
          candidates: candidateIds.map((candidateId) => new Types.ObjectId(candidateId)),
          completedSteps: [],
          pairKey,
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
        'Failed to update rishta progress'
      );
    }

    const existingSteps = new Set(progress.completedSteps);

    for (const step of CONSULTANT_PROGRESS_STEPS) {
      if (!existingSteps.has(step)) {
        progress.completedSteps.push(step);
        progress.stepDetails.push({
          completedAt: payload.marriedAt ?? new Date(),
          completedBy: new Types.ObjectId(userId),
          referenceId: marriageRecord._id,
          source: RishtaProgressStepSource.CONSULTANT_CONFIRMED,
          step,
        });
      }
    }

    progress.progressValue = 100;
    progress.status = RishtaProgressStatus.MARRIED;
    progress.marriageConfirmedBy = new Types.ObjectId(userId);
    progress.consultantUser = new Types.ObjectId(userId);
    progress.marriedAt = payload.marriedAt ?? new Date();
    await progress.save();

    marriageRecord.rishtaProgress = progress._id;
    await marriageRecord.save();

    await Promise.all([
      RishtaMarriageRequest.updateMany(
        { pairKey, status: RishtaMarriageRequestStatus.PENDING },
        { $set: { status: RishtaMarriageRequestStatus.CANCELLED } }
      ),
      ...candidateIds.map((candidateId) =>
        clearSwipeFeedSessionsForCandidate(candidateId)
      ),
    ]);

    if (consultationCase) {
      consultationCase.status = ConsultationCaseStatus.MARRIED;
      await consultationCase.save();
    }
  }

  return ConsultantMarriageRecord.findById(marriageRecord._id).lean();
};

const getConsultantMarriageRecords = async (
  userId: string,
  query: IConsultantMarriageRecordListQuery
) => {
  await assertActiveConsultant(userId);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {
    consultant: new Types.ObjectId(userId),
  };

  if (query.caseId) {
    assertValidObjectId(query.caseId, 'case id');
    filter.case = new Types.ObjectId(query.caseId);
  }

  const [data, total] = await Promise.all([
    ConsultantMarriageRecord.find(filter)
      .sort({ marriedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ConsultantMarriageRecord.countDocuments(filter),
  ]);

  return {
    data,
    meta: {
      limit,
      page,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

export const ConsultantService = {
  acceptCandidateInvite,
  addCandidateToCase,
  createCandidateInvite,
  createConsultantMarriageRecord,
  createConsultationCase,
  createGuestInvite,
  declineCandidateInvite,
  ensureCandidateConsultationCase,
  getAvailableConsultants,
  getConsultantMarriageRecords,
  getConsultationCase,
  getConsultationCases,
  getConsultationMessages,
  getGuestInvite,
  getGuestInviteMeetingContext,
  getGuestMessages,
  sendConsultationMessage,
  sendGuestMessage,
  startConsultationCase,
};
