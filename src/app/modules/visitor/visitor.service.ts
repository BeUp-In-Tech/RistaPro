
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import { OCCUPATIONS, RELIGIONS } from '../../constant/constant';
import AppError from '../../errorHelpers/AppError';
import {
  Gender,
  IVerificationStatus,
  VerificationState,
} from '../candidate/candidate.interface';
import Candidate from '../candidate/candidate.model';
import { CandidateLinkedUserStatus } from '../candidate/linked-user/candidateLinkedUser.interface';
import CandidateLinkedUser from '../candidate/linked-user/candidateLinkedUser.model';
import { ActiveStatus } from '../user/user.interface';
import {
  IProfileVisitorListQuery,
  IProfileVisitorListResponse,
  ITrackProfileVisitPayload,
} from './visitor.interface';
import Visitor from './visitor.model';

interface TVisitorCandidateLean {
  _id: Types.ObjectId;
  address?: string;
  dateOfBirth: Date;
  gender: Gender;
  images?: string[];
  name: string;
  occupation?: keyof typeof OCCUPATIONS;
  religion?: keyof typeof RELIGIONS;
  user:
    | Types.ObjectId
    | {
        _id: Types.ObjectId;
        isActive?: ActiveStatus;
        isDeleted?: boolean;
        isVerified?: boolean;
      }
    | null;
  verification_status?: IVerificationStatus;
};

interface TVisitorRowLean {
  _id: Types.ObjectId;
  createdAt?: Date;
  lastVisitedAt: Date;
  visitCount: number;
  visitedBy: Types.ObjectId | TVisitorCandidateLean | null;
  visitedProfile: Types.ObjectId;
};

const trackProfileVisit = async (
  userId: string,
  payload: ITrackProfileVisitPayload
) => {
  const [linkedAccess, legacyOwnerAccess] = await Promise.all([
    CandidateLinkedUser.exists({
      candidate: new Types.ObjectId(payload.candidateId),
      status: CandidateLinkedUserStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    }),
    Candidate.exists({
      _id: new Types.ObjectId(payload.candidateId),
      isActive: ActiveStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    }),
  ]);

  if (!linkedAccess && !legacyOwnerAccess) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You do not have access to manage this candidate profile'
    );
  }

  if (payload.candidateId === payload.visitedProfileId) {
    return {
      tracked: false,
      reason: 'SELF_VISIT',
    };
  }

  const now = new Date();
  const visitedBy = new Types.ObjectId(payload.candidateId);
  const visitedProfile = new Types.ObjectId(payload.visitedProfileId);

  void Visitor.updateOne(
    {
      visitedBy,
      visitedProfile,
    },
    {
      $inc: { visitCount: 1 },
      $set: { lastVisitedAt: now },
      $setOnInsert: {
        visitedBy,
        visitedProfile,
      },
    },
    {
      upsert: true,
    }
  ).catch(() => undefined);

  return {
    tracked: true,
    queued: true,
  };
};

const getProfileVisitors = async (
  userId: string,
  query: IProfileVisitorListQuery
): Promise<IProfileVisitorListResponse> => {
  const [linkedAccess, legacyOwnerAccess] = await Promise.all([
    CandidateLinkedUser.exists({
      candidate: new Types.ObjectId(query.candidateId),
      status: CandidateLinkedUserStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    }),
    Candidate.exists({
      _id: new Types.ObjectId(query.candidateId),
      isActive: ActiveStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    }),
  ]);

  if (!linkedAccess && !legacyOwnerAccess) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You do not have access to manage this candidate profile'
    );
  }

  const skip = (query.page - 1) * query.limit;
  const filter = {
    visitedProfile: new Types.ObjectId(query.candidateId),
  };

  const [visitors, total] = await Promise.all([
    Visitor.find(filter)
      .select('_id visitedBy visitedProfile lastVisitedAt visitCount createdAt')
      .sort({ lastVisitedAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate({
        match: {
          isActive: ActiveStatus.ACTIVE,
        },
        path: 'visitedBy',
        select:
          '_id name dateOfBirth gender images occupation religion address verification_status user isActive',
        populate: {
          path: 'user',
          select: '_id isActive isDeleted isVerified',
        },
      })
      .lean<TVisitorRowLean[]>(),
    Visitor.countDocuments(filter),
  ]);

  const now = new Date();
  const data = visitors.flatMap((visitor) => {
    if (
      !visitor.visitedBy ||
      visitor.visitedBy instanceof Types.ObjectId ||
      !('dateOfBirth' in visitor.visitedBy)
    ) {
      return [];
    }

    const candidate = visitor.visitedBy;
    const owner =
      candidate.user &&
      typeof candidate.user === 'object' &&
      'isVerified' in candidate.user
        ? candidate.user
        : null;
    let age = now.getFullYear() - candidate.dateOfBirth.getFullYear();
    const monthDiff = now.getMonth() - candidate.dateOfBirth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && now.getDate() < candidate.dateOfBirth.getDate())
    ) {
      age -= 1;
    }

    return [
      {
        _id: candidate._id,
        age,
        badge: Boolean(
          owner?.isVerified &&
            candidate.verification_status?.face_verified?.status ===
              VerificationState.APPROVED &&
            candidate.verification_status?.id_verified?.status ===
              VerificationState.APPROVED &&
            candidate.verification_status?.education_verified?.status ===
              VerificationState.APPROVED &&
            candidate.verification_status?.parent_verified?.status ===
              VerificationState.APPROVED
        ),
        gender: candidate.gender,
        images: (candidate.images ?? []).slice(0, 1),
        labels: {
          occupation: candidate.occupation
            ? OCCUPATIONS[candidate.occupation]
            : undefined,
          religion: candidate.religion ? RELIGIONS[candidate.religion] : undefined,
        },
        lastVisitedAt: visitor.lastVisitedAt,
        livesIn: candidate.address?.split(',')[0]?.trim() || undefined,
        name: candidate.name,
        occupation: candidate.occupation,
        religion: candidate.religion,
        visitCount: visitor.visitCount,
      },
    ];
  });

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

export const VisitorService = {
  getProfileVisitors,
  trackProfileVisit,
};
