
import { RtcRole, RtcTokenBuilder } from 'agora-access-token';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import env from '../../config/env';
import AppError from '../../errorHelpers/AppError';
import {
  removeMeetingReminderByBullMQ,
  scheduleMeetingReminderByBullMQ,
  sendMailByBullMQ,
  sendNotificationByBullMQ,
} from '../../utils/backgroundJobProcessingHelper';
import Candidate from '../candidate/candidate.model';
import { getActiveLinkedUserAccessOrThrow } from '../candidate/linked-user/candidateLinkedUser.helper';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserStatus,
} from '../candidate/linked-user/candidateLinkedUser.interface';
import CandidateLinkedUser from '../candidate/linked-user/candidateLinkedUser.model';
import { ConsultantService } from '../consultant/consultant.service';
import { ConsultationCase } from '../consultant/consultant.model';
import { IConsultationCase } from '../consultant/consultant.interface';
import { NotificationType } from '../notification/notification.interface';
import { PLANS } from '../plan/plan.constant';
import { IPlan, PLAN_KEYS, PlanKey } from '../plan/plan.interface';
import PlanModel from '../plan/plan.model';
import { ActiveStatus, Role } from '../user/user.interface';
import User from '../user/user.model';
import {
  IConfirmMeetingSchedulePayload,
  ICreateMeetingSchedulePayload,
  IJoinMeetingSchedulePayload,
  IMeetingSchedule,
  IMeetingScheduleListQuery,
  IRescheduleMeetingPayload,
  MeetingParticipantRole,
  MeetingStatus,
} from './meetingSchedule.interface';
import MeetingSchedule from './meetingSchedule.model';

const JOIN_WINDOW_BEFORE_MS = 10 * 60 * 1000;
const MEETING_DURATION_MS = 60 * 60 * 1000;
const REMINDER_BEFORE_MS = 60 * 60 * 1000;

interface TMeetingUserRecipient {
  _id: Types.ObjectId;
  email: string;
  full_name: string;
};

interface TMeetingCandidateAccess {
  _id?: Types.ObjectId;
  accessRole: CandidateLinkedUserAccessRole;
  candidate: Types.ObjectId;
  user: Types.ObjectId;
}

const assertValidObjectId = (value: string, label: string) => {
  if (!Types.ObjectId.isValid(value)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid ${label}`);
  }
};

const getPlanKeyOrDefault = (plan?: string): PlanKey =>
  PLAN_KEYS.includes(plan as PlanKey) ? (plan as PlanKey) : 'free';

const getMeetingJoinState = (meeting: Pick<
  IMeetingSchedule,
  'joinWindowEndsAt' | 'joinWindowStartsAt' | 'schedule_time' | 'status'
>) => {
  const now = Date.now();
  const startsAt = meeting.joinWindowStartsAt?.getTime();
  const endsAt = meeting.joinWindowEndsAt?.getTime();

  return Boolean(
    meeting.status === MeetingStatus.CONFIRMED &&
      meeting.schedule_time &&
      startsAt &&
      endsAt &&
      now >= startsAt &&
      now <= endsAt
  );
};

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

const assertCanUseConsultant = async (candidateId: string) => {
  const plan = await getCandidatePlanOrThrow(candidateId);

  if (!plan.canUseConsultant) {
    throw new AppError(
      StatusCodes.PAYMENT_REQUIRED,
      'Consultant video meetings are available on the platinum plan'
    );
  }

  return plan;
};

const assertWritableCandidateAccess = (accessRole: CandidateLinkedUserAccessRole) => {
  if (accessRole === CandidateLinkedUserAccessRole.VIEWER) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Viewer access cannot manage consultant meetings'
    );
  }
};

const getMeetingCase = async (meeting: Pick<IMeetingSchedule, 'case'>) => {
  if (!meeting.case) {
    return null;
  }

  return ConsultationCase.findById(meeting.case)
    .select('_id candidates consultant primaryCandidate status')
    .lean<IConsultationCase | null>();
};

const getMeetingCandidateIds = (
  meeting: Pick<IMeetingSchedule, 'candidate'>,
  consultationCase: IConsultationCase | null
) => {
  const ids = [
    meeting.candidate.toString(),
    ...(consultationCase?.candidates.map((candidate) => candidate.toString()) ??
      []),
  ];

  return Array.from(new Set(ids));
};

const getMeetingCandidateAccess = async (params: {
  candidateId?: string;
  consultationCase: IConsultationCase | null;
  meeting: IMeetingSchedule;
  requireWritable?: boolean;
  userId: string;
}) => {
  const candidateIds = getMeetingCandidateIds(
    params.meeting,
    params.consultationCase
  );
  let candidateId = params.candidateId;

  if (candidateId) {
    assertValidObjectId(candidateId, 'candidate id');

    if (!candidateIds.includes(candidateId)) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        'This candidate cannot access this meeting'
      );
    }
  }

  const candidateObjectIds = (candidateId ? [candidateId] : candidateIds).map(
    (id) => new Types.ObjectId(id)
  );

  let access = await CandidateLinkedUser.findOne({
    candidate: { $in: candidateObjectIds },
    status: CandidateLinkedUserStatus.ACTIVE,
    user: new Types.ObjectId(params.userId),
  })
    .select('_id candidate user accessRole')
    .lean<TMeetingCandidateAccess | null>();

  if (!access) {
    const legacyCandidate = await Candidate.findOne({
      _id: { $in: candidateObjectIds },
      isActive: ActiveStatus.ACTIVE,
      user: new Types.ObjectId(params.userId),
    })
      .select('_id user')
      .lean<{ _id: Types.ObjectId; user: Types.ObjectId } | null>();

    if (legacyCandidate) {
      access = {
        accessRole: CandidateLinkedUserAccessRole.OWNER,
        candidate: legacyCandidate._id,
        user: legacyCandidate.user,
      };
    }
  }

  if (!access) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You cannot access this meeting'
    );
  }

  if (params.requireWritable) {
    assertWritableCandidateAccess(access.accessRole);
  }

  candidateId = access.candidate.toString();
  const primaryCandidateId =
    params.consultationCase?.primaryCandidate?.toString() ??
    params.meeting.candidate.toString();

  if (candidateId === primaryCandidateId) {
    await assertCanUseConsultant(candidateId);
  }

  return {
    access,
    candidateId,
    linkedUserId: access._id,
  };
};

const getActiveConsultantOrThrow = async (consultantId: string) => {
  const consultant = await User.findOne({
    _id: consultantId,
    isActive: ActiveStatus.ACTIVE,
    isDeleted: false,
    role: Role.CONSULTANT,
  })
    .select('_id full_name email')
    .lean<TMeetingUserRecipient | null>();

  if (!consultant) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Consultant not found');
  }

  return consultant;
};

const getCandidateMeetingRecipients = async (candidateId: Types.ObjectId) => {
  const linkedUsers = await CandidateLinkedUser.find({
    accessRole: {
      $in: [
        CandidateLinkedUserAccessRole.OWNER,
        CandidateLinkedUserAccessRole.EDITOR,
      ],
    },
    candidate: candidateId,
    status: CandidateLinkedUserStatus.ACTIVE,
  })
    .populate({
      path: 'user',
      select: '_id full_name email',
    })
    .select('user')
    .lean<
      {
        user: TMeetingUserRecipient | Types.ObjectId | null;
      }[]
    >();

  return linkedUsers.flatMap((linkedUser) => {
    if (
      linkedUser.user &&
      typeof linkedUser.user === 'object' &&
      'email' in linkedUser.user
    ) {
      return [linkedUser.user];
    }

    return [];
  });
};

const getMeetingRecipients = async (meeting: Pick<
  IMeetingSchedule,
  'candidate' | 'consultant'
>) => {
  const [consultant, candidateRecipients] = await Promise.all([
    User.findById(meeting.consultant)
      .select('_id full_name email')
      .lean<TMeetingUserRecipient | null>(),
    getCandidateMeetingRecipients(meeting.candidate),
  ]);

  return [...(consultant ? [consultant] : []), ...candidateRecipients].filter(
    (recipient, index, recipients) =>
      recipients.findIndex((item) => item._id.toString() === recipient._id.toString()) === index
  );
};

const scheduleOneHourReminder = async (meeting: Pick<
  IMeetingSchedule,
  '_id' | 'schedule_time'
>) => {
  if (!meeting.schedule_time) {
    return;
  }

  await scheduleMeetingReminderByBullMQ(
    meeting._id.toString(),
    new Date(meeting.schedule_time.getTime() - REMINDER_BEFORE_MS)
  );
};

const buildMeetingResponse = (meeting: IMeetingSchedule) => ({
  _id: meeting._id,
  agoraChannelName: meeting.agoraChannelName,
  canJoin: getMeetingJoinState(meeting),
  candidate: meeting.candidate,
  case: meeting.case,
  consultant: meeting.consultant,
  consultantNote: meeting.consultantNote,
  createdAt: meeting.createdAt,
  joinWindowEndsAt: meeting.joinWindowEndsAt,
  joinWindowStartsAt: meeting.joinWindowStartsAt,
  note: meeting.note,
  participants: meeting.participants,
  requestedBy: meeting.requestedBy,
  requestedTimeSlots: meeting.requestedTimeSlots ?? [],
  rescheduleCount: meeting.rescheduleCount,
  schedule_time: meeting.schedule_time,
  status: meeting.status,
  type: meeting.type,
  updatedAt: meeting.updatedAt,
});

const createMeetingSchedule = async (
  userId: string,
  payload: ICreateMeetingSchedulePayload
) => {
  assertValidObjectId(payload.candidateId, 'candidate id');
  assertValidObjectId(payload.consultantId, 'consultant id');

  const [{ access }, consultant] = await Promise.all([
    getActiveLinkedUserAccessOrThrow({
      candidateId: payload.candidateId,
      userId,
    }),
    getActiveConsultantOrThrow(payload.consultantId),
    assertCanUseConsultant(payload.candidateId),
  ]);

  assertWritableCandidateAccess(access.accessRole);

  const consultationCase = await ConsultantService.ensureCandidateConsultationCase(
    userId,
    {
      candidateId: payload.candidateId,
      consultantId: payload.consultantId,
      note: payload.note,
      title: 'Consultant meeting',
    }
  );

  const meeting = await MeetingSchedule.create({
    candidate: new Types.ObjectId(payload.candidateId),
    case: consultationCase._id,
    consultant: consultant._id,
    note: payload.note?.trim(),
    requestedBy: new Types.ObjectId(userId),
    requestedTimeSlots: payload.requestedTimeSlots ?? [],
    status: MeetingStatus.PENDING,
    type: payload.type,
  });

  void sendNotificationByBullMQ(
    {
      body: 'A candidate requested a consultant meeting.',
      data: {
        action: 'CONSULTANT_MEETING_REQUESTED',
        candidateId: payload.candidateId,
        meetingId: meeting._id.toString(),
      },
      deepLink: `${env.DEEP_LINK}meeting-schedules/${meeting._id.toString()}`,
      entityId: meeting._id,
      title: 'New meeting request',
      type: NotificationType.SYSTEM,
      user: consultant._id,
      webUrl: `/meeting-schedules/${meeting._id.toString()}`,
    },
    `meeting_requested_${meeting._id.toString()}_${consultant._id.toString()}`
  ).catch(() => undefined);

  return buildMeetingResponse(meeting);
};

const confirmMeetingSchedule = async (
  userId: string,
  meetingId: string,
  payload: IConfirmMeetingSchedulePayload
) => {
  assertValidObjectId(meetingId, 'meeting id');

  const meeting = await MeetingSchedule.findById(meetingId);

  if (!meeting) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Meeting schedule not found');
  }

  if (meeting.consultant.toString() !== userId) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only the assigned consultant can confirm this meeting'
    );
  }

  if (
    [MeetingStatus.CANCELLED, MeetingStatus.COMPLETED, MeetingStatus.REJECTED].includes(
      meeting.status
    )
  ) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This meeting can no longer be confirmed'
    );
  }

  const scheduleTime = new Date(payload.schedule_time);
  meeting.confirmedBy = new Types.ObjectId(userId);
  meeting.agoraChannelName = undefined;
  meeting.consultantNote = payload.consultantNote?.trim();
  meeting.joinWindowEndsAt = new Date(scheduleTime.getTime() + MEETING_DURATION_MS);
  meeting.joinWindowStartsAt = new Date(
    scheduleTime.getTime() - JOIN_WINDOW_BEFORE_MS
  );
  meeting.participants = [];
  meeting.reminderOneHourSentAt = undefined;
  meeting.schedule_time = scheduleTime;
  meeting.status = MeetingStatus.CONFIRMED;
  await meeting.save();

  await scheduleOneHourReminder(meeting);

  const candidateRecipients = await getCandidateMeetingRecipients(meeting.candidate);
  void Promise.all(
    candidateRecipients.map((recipient) =>
      sendNotificationByBullMQ(
        {
          body: 'Your consultant video meeting has been confirmed.',
          data: {
            action: 'CONSULTANT_MEETING_CONFIRMED',
            meetingId: meeting._id.toString(),
          },
          deepLink: `${env.DEEP_LINK}meeting-schedules/${meeting._id.toString()}`,
          entityId: meeting._id,
          title: 'Meeting confirmed',
          type: NotificationType.SYSTEM,
          user: recipient._id,
          webUrl: `/meeting-schedules/${meeting._id.toString()}`,
        },
        `meeting_confirmed_${meeting._id.toString()}_${recipient._id.toString()}`
      )
    )
  ).catch(() => undefined);

  return buildMeetingResponse(meeting);
};

const rescheduleMeeting = async (
  userId: string,
  role: Role,
  meetingId: string,
  payload: IRescheduleMeetingPayload
) => {
  assertValidObjectId(meetingId, 'meeting id');

  const meeting = await MeetingSchedule.findById(meetingId);

  if (!meeting) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Meeting schedule not found');
  }

  if (
    [MeetingStatus.CANCELLED, MeetingStatus.COMPLETED, MeetingStatus.REJECTED].includes(
      meeting.status
    )
  ) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This meeting can no longer be rescheduled'
    );
  }

  let notifyUserIds: Types.ObjectId[] = [];

  if (role === Role.CONSULTANT) {
    if (meeting.consultant.toString() !== userId) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        'Only the assigned consultant can reschedule this meeting'
      );
    }

    notifyUserIds = (await getCandidateMeetingRecipients(meeting.candidate)).map(
      (recipient) => recipient._id
    );
  } else if (role === Role.USER) {
    const { access } = await getActiveLinkedUserAccessOrThrow({
      candidateId: meeting.candidate.toString(),
      userId,
    });
    assertWritableCandidateAccess(access.accessRole);
    await assertCanUseConsultant(meeting.candidate.toString());
    notifyUserIds = [meeting.consultant];
  } else {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only candidates and consultants can reschedule meetings'
    );
  }

  await removeMeetingReminderByBullMQ(meeting._id.toString());
  meeting.rescheduleCount += 1;
  meeting.reminderOneHourSentAt = undefined;

  if (payload.requestedTimeSlots !== undefined) {
    meeting.requestedTimeSlots = payload.requestedTimeSlots;
  }

  if (payload.note !== undefined) {
    meeting.note = payload.note.trim();
  }

  if (payload.consultantNote !== undefined) {
    meeting.consultantNote = payload.consultantNote.trim();
  }

  if (role === Role.CONSULTANT && payload.schedule_time) {
    const scheduleTime = new Date(payload.schedule_time);
    meeting.agoraChannelName = undefined;
    meeting.confirmedBy = new Types.ObjectId(userId);
    meeting.joinWindowEndsAt = new Date(scheduleTime.getTime() + MEETING_DURATION_MS);
    meeting.joinWindowStartsAt = new Date(
      scheduleTime.getTime() - JOIN_WINDOW_BEFORE_MS
    );
    meeting.participants = [];
    meeting.schedule_time = scheduleTime;
    meeting.status = MeetingStatus.CONFIRMED;
    await meeting.save();
    await scheduleOneHourReminder(meeting);
  } else {
    meeting.joinWindowEndsAt = undefined;
    meeting.joinWindowStartsAt = undefined;
    meeting.schedule_time = payload.schedule_time
      ? new Date(payload.schedule_time)
      : undefined;
    meeting.status = MeetingStatus.RESCHEDULE_REQUESTED;
    await meeting.save();
  }

  void Promise.all(
    notifyUserIds.map((targetUserId) =>
      sendNotificationByBullMQ(
        {
          body:
            meeting.status === MeetingStatus.CONFIRMED
              ? 'Your consultant video meeting has been rescheduled.'
              : 'A consultant video meeting reschedule was requested.',
          data: {
            action: 'CONSULTANT_MEETING_RESCHEDULED',
            meetingId: meeting._id.toString(),
          },
          deepLink: `${env.DEEP_LINK}meeting-schedules/${meeting._id.toString()}`,
          entityId: meeting._id,
          title: 'Meeting rescheduled',
          type: NotificationType.SYSTEM,
          user: targetUserId,
          webUrl: `/meeting-schedules/${meeting._id.toString()}`,
        },
        `meeting_rescheduled_${meeting._id.toString()}_${targetUserId.toString()}`
      )
    )
  ).catch(() => undefined);

  return buildMeetingResponse(meeting);
};

const getMeetingSchedule = async (
  userId: string,
  role: Role,
  meetingId: string
) => {
  assertValidObjectId(meetingId, 'meeting id');

  const meeting = await MeetingSchedule.findById(meetingId);

  if (!meeting) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Meeting schedule not found');
  }

  if (role === Role.CONSULTANT) {
    if (meeting.consultant.toString() !== userId) {
      throw new AppError(StatusCodes.FORBIDDEN, 'You cannot view this meeting');
    }
  } else if (role === Role.USER) {
    const consultationCase = await getMeetingCase(meeting);
    await getMeetingCandidateAccess({
      consultationCase,
      meeting,
      userId,
    });
  } else {
    throw new AppError(StatusCodes.FORBIDDEN, 'You cannot view this meeting');
  }

  return buildMeetingResponse(meeting);
};

const getMeetingSchedules = async (
  userId: string,
  role: Role,
  query: IMeetingScheduleListQuery
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
    await getActiveLinkedUserAccessOrThrow({
      candidateId: query.candidateId,
      userId,
    });
    const candidateObjectId = new Types.ObjectId(query.candidateId);
    const caseRows = await ConsultationCase.find({
      candidates: candidateObjectId,
    })
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>();

    filter.$or = [
      { candidate: candidateObjectId },
      { case: { $in: caseRows.map((consultationCase) => consultationCase._id) } },
    ];
  } else {
    throw new AppError(StatusCodes.FORBIDDEN, 'You cannot view meetings');
  }

  const meetings = await MeetingSchedule.find(filter)
    .sort({ schedule_time: 1, createdAt: -1 })
    .lean<IMeetingSchedule[]>();

  return meetings.map((meeting) => buildMeetingResponse(meeting));
};

const getNextAgoraUid = (usedUids: Set<number>) => {
  let uid = Math.floor(Math.random() * 2147483000) + 1;

  while (usedUids.has(uid)) {
    uid = Math.floor(Math.random() * 2147483000) + 1;
  }

  return uid;
};

const joinMeetingSchedule = async (
  userId: string,
  role: Role,
  meetingId: string,
  payload: IJoinMeetingSchedulePayload = {}
) => {
  assertValidObjectId(meetingId, 'meeting id');

  const meeting = await MeetingSchedule.findById(meetingId);

  if (!meeting) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Meeting schedule not found');
  }

  if (!getMeetingJoinState(meeting)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Meeting can be joined only from 10 minutes before the scheduled time'
    );
  }

  const consultationCase = await getMeetingCase(meeting);
  let participantRole: MeetingParticipantRole;
  let linkedUserId: Types.ObjectId | undefined;
  let candidateId: Types.ObjectId | undefined;

  if (role === Role.CONSULTANT) {
    if (meeting.consultant.toString() !== userId) {
      throw new AppError(StatusCodes.FORBIDDEN, 'You cannot join this meeting');
    }
    participantRole = MeetingParticipantRole.CONSULTANT;
  } else if (role === Role.USER) {
    const meetingAccess = await getMeetingCandidateAccess({
      candidateId: payload.candidateId,
      consultationCase,
      meeting,
      requireWritable: true,
      userId,
    });
    candidateId = new Types.ObjectId(meetingAccess.candidateId);
    linkedUserId = meetingAccess.linkedUserId;
    participantRole = MeetingParticipantRole.CANDIDATE;
  } else {
    throw new AppError(StatusCodes.FORBIDDEN, 'You cannot join this meeting');
  }

  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Agora credentials are not configured'
    );
  }

  if (!meeting.agoraChannelName) {
    meeting.agoraChannelName = `meeting_${meeting._id.toString()}`;
  }

  const existingParticipant = meeting.participants.find((participant) => {
    if (role === Role.CONSULTANT) {
      return participant.user?.toString() === userId;
    }

    return (
      participant.user?.toString() === userId &&
      participant.candidate?.toString() === candidateId?.toString()
    );
  });
  const usedUids = new Set(
    meeting.participants.map((participant) => participant.agoraUid)
  );
  const agoraUid = existingParticipant?.agoraUid ?? getNextAgoraUid(usedUids);

  if (!existingParticipant) {
    meeting.participants.push({
      agoraUid,
      ...(candidateId ? { candidate: candidateId } : {}),
      joinedAt: new Date(),
      ...(linkedUserId ? { linkedUser: linkedUserId } : {}),
      role: participantRole,
      user: new Types.ObjectId(userId),
    });
    await meeting.save();
  }

  const tokenTtlSeconds = Number.isFinite(env.AGORA_TOKEN_TTL_SECONDS)
    ? Math.min(Math.max(env.AGORA_TOKEN_TTL_SECONDS, 60), 86400)
    : 3600;
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + tokenTtlSeconds;
  const token = RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    meeting.agoraChannelName,
    agoraUid,
    RtcRole.PUBLISHER,
    expiresAtSeconds
  );

  return {
    agora: {
      appId: env.AGORA_APP_ID,
      channelName: meeting.agoraChannelName,
      expiresAt: new Date(expiresAtSeconds * 1000),
      token,
      uid: agoraUid,
    },
    meeting: buildMeetingResponse(meeting),
  };
};

const joinGuestMeetingSchedule = async (token: string, meetingId: string) => {
  assertValidObjectId(meetingId, 'meeting id');

  const meeting = await MeetingSchedule.findById(meetingId);

  if (!meeting) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Meeting schedule not found');
  }

  if (!getMeetingJoinState(meeting)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Meeting can be joined only from 10 minutes before the scheduled time'
    );
  }

  if (!meeting.case) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Guest meeting access requires a consultation case'
    );
  }

  const { consultationCase, invite } =
    await ConsultantService.getGuestInviteMeetingContext(token);

  if (meeting.case.toString() !== consultationCase._id.toString()) {
    throw new AppError(StatusCodes.FORBIDDEN, 'Guest invite cannot access this meeting');
  }

  if (!env.AGORA_APP_ID || !env.AGORA_APP_CERTIFICATE) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Agora credentials are not configured'
    );
  }

  if (!meeting.agoraChannelName) {
    meeting.agoraChannelName = `meeting_${meeting._id.toString()}`;
  }

  const existingParticipant = meeting.participants.find(
    (participant) =>
      participant.guestInvite?.toString() === invite._id.toString() &&
      participant.role === MeetingParticipantRole.GUEST
  );
  const usedUids = new Set(
    meeting.participants.map((participant) => participant.agoraUid)
  );
  const agoraUid = existingParticipant?.agoraUid ?? getNextAgoraUid(usedUids);

  if (!existingParticipant) {
    meeting.participants.push({
      agoraUid,
      guestDisplayName: invite.displayName,
      guestInvite: invite._id,
      joinedAt: new Date(),
      role: MeetingParticipantRole.GUEST,
    });
    await meeting.save();
  }

  const tokenTtlSeconds = Number.isFinite(env.AGORA_TOKEN_TTL_SECONDS)
    ? Math.min(Math.max(env.AGORA_TOKEN_TTL_SECONDS, 60), 86400)
    : 3600;
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + tokenTtlSeconds;
  const agoraToken = RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    meeting.agoraChannelName,
    agoraUid,
    RtcRole.PUBLISHER,
    expiresAtSeconds
  );

  return {
    agora: {
      appId: env.AGORA_APP_ID,
      channelName: meeting.agoraChannelName,
      expiresAt: new Date(expiresAtSeconds * 1000),
      token: agoraToken,
      uid: agoraUid,
    },
    meeting: buildMeetingResponse(meeting),
  };
};

const sendOneHourMeetingReminder = async (meetingId: string) => {
  assertValidObjectId(meetingId, 'meeting id');

  const meeting = await MeetingSchedule.findById(meetingId);

  if (
    !meeting ||
    meeting.status !== MeetingStatus.CONFIRMED ||
    !meeting.schedule_time ||
    meeting.reminderOneHourSentAt
  ) {
    return null;
  }

  const recipients = await getMeetingRecipients(meeting);
  const meetingTime = meeting.schedule_time.toISOString();
  const meetingUrl = `${env.FRONTEND_URL}/meeting-schedules/${meeting._id.toString()}`;

  await Promise.all(
    recipients.flatMap((recipient) => [
      sendNotificationByBullMQ(
        {
          body: `Your video meeting is scheduled at ${meetingTime} with consultant.`,
          data: {
            action: 'CONSULTANT_MEETING_REMINDER_1H',
            meetingId: meeting._id.toString(),
          },
          deepLink: `${env.DEEP_LINK}meeting-schedules/${meeting._id.toString()}`,
          entityId: meeting._id,
          title: 'Meeting starts in 1 hour',
          type: NotificationType.REMINDER,
          user: recipient._id,
          webUrl: `/meeting-schedules/${meeting._id.toString()}`,
        },
        `meeting_reminder_notification_${meeting._id.toString()}_${recipient._id.toString()}`
      ),
      sendMailByBullMQ(
        {
          subject: 'Your RishtaPro video meeting starts in 1 hour',
          templateData: {
            joinWindowStartsAt: meeting.joinWindowStartsAt?.toISOString(),
            meetingTime,
            meetingUrl,
            name: recipient.full_name,
          },
          templateName: 'meetingReminder',
          to: recipient.email,
        },
        `meeting_reminder_email_${meeting._id.toString()}_${recipient._id.toString()}`
      ),
    ])
  );

  meeting.reminderOneHourSentAt = new Date();
  await meeting.save();

  return buildMeetingResponse(meeting);
};

export const MeetingScheduleService = {
  confirmMeetingSchedule,
  createMeetingSchedule,
  getMeetingSchedule,
  getMeetingSchedules,
  joinGuestMeetingSchedule,
  joinMeetingSchedule,
  rescheduleMeeting,
  sendOneHourMeetingReminder,
};
