import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import { redisClient } from '../../config/redis.config';
import AppError from '../../errorHelpers/AppError';
import { PLANS } from '../plan/plan.constant';
import { IPlan, PLAN_KEYS, PlanKey } from '../plan/plan.interface';
import PlanModel from '../plan/plan.model';
import Candidate from '../candidate/candidate.model';
import { ActiveStatus, IUser } from '../user/user.interface';
import User from '../user/user.model';
import Like from '../like/like.model';
import { LikeSource, LikeType } from '../like/like.interface';
import Match from '../match/match.model';
import { MatchStatus } from '../match/match.interface';
import Report from '../report/report.model';
import {
  buildSwipePairKey,
  getCurrentLikeQuotaWindowStart,
  getNextLikeQuotaResetAt,
  getSwipeActionLockKey,
  SWIPE_ACTION_LOCK_TTL_SECONDS,
} from './swipe.utility';

const USER_QUOTA_SELECT =
  '_id plan isActive isDeleted';

export interface TSwipeActionLean {
  _id: Types.ObjectId;
  actedBy?: Types.ObjectId;
  isActive: boolean;
  likedBy: Types.ObjectId;
  likedProfile: Types.ObjectId;
  source: LikeSource;
  type: LikeType;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TSwipeMatchLean {
  _id: Types.ObjectId;
  candidates: Types.ObjectId[];
  conversation?: Types.ObjectId;
  matchedBy?: Types.ObjectId;
  pairKey: string;
  status: MatchStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

interface TSwipeQuotaUserLean extends Pick<
  IUser,
  | '_id'
  | 'isActive'
  | 'isDeleted'
  | 'plan'
> {
  _id: Types.ObjectId;
}

interface TSwipePlanQuota {
  dailyLikes: number;
  superLikes: number;
}

interface TSwipeActionLock {
  key: string;
  token: string;
}

const getDuplicateKeyCode = (error: unknown) =>
  (error as { code?: number }).code;

const getPlanKeyOrDefault = (plan?: string): PlanKey =>
  PLAN_KEYS.includes(plan as PlanKey) ? (plan as PlanKey) : 'free';

// Keep one shared active-action query so legacy rows without isActive still hide a card.
const getActiveActionQuery = (likedBy: string, likedProfile: string) => ({
  likedBy,
  likedProfile,
  $or: [{ isActive: true }, { isActive: { $exists: false } }],
});

// Only active, verified-owner profiles can be acted on, matching the feed visibility rule.
export const getSwipeTargetCandidateOrThrow = async (
  targetCandidateId: string
) => {
  const targetCandidate = await Candidate.findOne({
    _id: targetCandidateId,
    isActive: ActiveStatus.ACTIVE,
  })
    .select('_id user isActive')
    .populate({
      match: {
        isActive: ActiveStatus.ACTIVE,
        isDeleted: false,
        isVerified: true,
      },
      path: 'user',
      select: '_id isActive isDeleted isVerified',
    })
    .lean<{
      _id: Types.ObjectId;
      isActive: ActiveStatus;
      user: Types.ObjectId | null;
    } | null>();

  if (!targetCandidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Target candidate not found');
  }

  if (!targetCandidate.user) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Target candidate is not available for swipe'
    );
  }

  return targetCandidate;
};

// A report in either direction freezes interaction between the two candidate profiles.
export const assertNoSwipeReportBetweenCandidates = async (params: {
  candidateId: string;
  targetCandidateId: string;
}) => {
  const report = await Report.exists({
    $or: [
      {
        reportedBy: params.candidateId,
        reportedCandidate: params.targetCandidateId,
      },
      {
        reportedBy: params.targetCandidateId,
        reportedCandidate: params.candidateId,
      },
    ],
  });

  if (report) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Swipe action is blocked because a report exists between these candidates'
    );
  }
};

// Redis lock is a short guard against double taps; DB unique indexes remain the final safety net.
export const acquireSwipeActionLock = async (params: {
  candidateId: string;
  targetCandidateId: string;
}): Promise<TSwipeActionLock | null> => {
  if (!redisClient.isOpen) {
    return null;
  }

  const key = getSwipeActionLockKey(params.candidateId, params.targetCandidateId);
  const token = crypto.randomBytes(8).toString('hex');

  try {
    const acquired = await redisClient.set(key, token, {
      EX: SWIPE_ACTION_LOCK_TTL_SECONDS,
      NX: true,
    });

    if (!acquired) {
      throw new AppError(
        StatusCodes.CONFLICT,
        'Swipe action is already being processed'
      );
    }

    return { key, token };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    return null;
  }
};

// Compare the lock token before delete so an expired/recreated lock is not removed accidentally.
export const releaseSwipeActionLock = async (lock: TSwipeActionLock | null) => {
  if (!lock || !redisClient.isOpen) {
    return;
  }

  try {
    const currentToken = await redisClient.get(lock.key);

    if (currentToken === lock.token) {
      await redisClient.del(lock.key);
    }
  } catch {
    // Lock cleanup must never turn a successful swipe into a failed response.
  }
};

// Clears ranked feed sessions after a swipe so cursor pages do not show stale cards.
export const clearSwipeFeedSessionsForCandidate = async (candidateId: string) => {
  if (!redisClient.isOpen) {
    return;
  }

  try {
    let cursor = '0';

    do {
      const { cursor: nextCursor, keys } = await redisClient.scan(cursor, {
        COUNT: 100,
        MATCH: `swipe_feed:${candidateId}:*`,
      });

      cursor = nextCursor;

      if (keys.length) {
        await redisClient.del(keys);
      }
    } while (cursor !== '0');
  } catch {
    // Feed cache is disposable; DB actions remain the source of truth.
  }
};

// Loads the primary profile owner because plan limits belong to the candidate profile.
export const getSwipeQuotaOwnerOrThrow = async (ownerUserId: string) => {
  const owner = await User.findById(ownerUserId)
    .select(USER_QUOTA_SELECT)
    .lean<TSwipeQuotaUserLean | null>();

  if (!owner) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate owner not found');
  }

  if (owner.isDeleted || owner.isActive !== ActiveStatus.ACTIVE) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Candidate owner is not active'
    );
  }

  return owner;
};

// Prefer the admin-created plan document, but fall back to static plan defaults for local/dev data.
export const getSwipePlanOrDefault = async (
  plan?: string
): Promise<TSwipePlanQuota> => {
  const planKey = getPlanKeyOrDefault(plan);
  const planDocument = await PlanModel.findOne({
    isActive: true,
    key: planKey,
  })
    .select('dailyLikes superLikes')
    .lean<Pick<IPlan, 'dailyLikes' | 'superLikes'> | null>();

  return planDocument ?? PLANS[planKey];
};

export const getSwipeQuotaUsage = async (params: {
  candidateId: string;
  now?: Date;
}) => {
  const { candidateId, now = new Date() } = params;
  const currentWindowStart = getCurrentLikeQuotaWindowStart(now);
  const [dailyLikeUsed, superLikeUsed] = await Promise.all([
    Like.countDocuments({
      createdAt: { $gte: currentWindowStart },
      likedBy: candidateId,
      type: LikeType.LIKE,
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    }),
    Like.countDocuments({
      createdAt: { $gte: currentWindowStart },
      likedBy: candidateId,
      type: LikeType.SUPER_LIKE,
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    }),
  ]);

  return { dailyLikeUsed, superLikeUsed };
};

export const buildSwipeQuotaResponse = async (params: {
  candidateId: string;
  now?: Date;
  plan: TSwipePlanQuota;
}) => {
  const { candidateId, now = new Date(), plan } = params;
  const usage = await getSwipeQuotaUsage({ candidateId, now });

  return {
    dailyLikeRemaining: Math.max(0, plan.dailyLikes - usage.dailyLikeUsed),
    nextResetAt: getNextLikeQuotaResetAt(now),
    superLikeRemaining: Math.max(0, plan.superLikes - usage.superLikeUsed),
  };
};

export const findExistingSwipeAction = async (params: {
  candidateId: string;
  targetCandidateId: string;
}) =>
  Like.findOne(
    getActiveActionQuery(params.candidateId, params.targetCandidateId)
  ).lean<TSwipeActionLean | null>();

export const createSwipeActionOrGetExisting = async (params: {
  actedBy: string;
  candidateId: string;
  source: LikeSource;
  targetCandidateId: string;
  type: LikeType;
}) => {
  try {
    const action = await Like.create({
      actedBy: params.actedBy,
      isActive: true,
      likedBy: params.candidateId,
      likedProfile: params.targetCandidateId,
      source: params.source,
      type: params.type,
    });

    return {
      action: action.toObject() as TSwipeActionLean,
      created: true,
    };
  } catch (error) {
    if (getDuplicateKeyCode(error) !== 11000) {
      throw error;
    }

    const existingAction = await findExistingSwipeAction(params);

    if (!existingAction) {
      throw error;
    }

    return {
      action: existingAction,
      created: false,
    };
  }
};

// Positive reverse action is the Tinder-style "they already liked you" check.
export const findPositiveReverseSwipeAction = async (params: {
  candidateId: string;
  targetCandidateId: string;
}) =>
  Like.findOne({
    ...getActiveActionQuery(params.targetCandidateId, params.candidateId),
    type: { $in: [LikeType.LIKE, LikeType.SUPER_LIKE] },
  }).lean<TSwipeActionLean | null>();

export const findActiveSwipeMatch = async (params: {
  candidateId: string;
  targetCandidateId: string;
}) => {
  const pairKey = buildSwipePairKey(params.candidateId, params.targetCandidateId);

  return Match.findOne({
    $or: [
      { pairKey, status: MatchStatus.ACTIVE },
      {
        candidates: {
          $all: [
            new Types.ObjectId(params.candidateId),
            new Types.ObjectId(params.targetCandidateId),
          ],
        },
        $or: [{ status: MatchStatus.ACTIVE }, { status: { $exists: false } }],
      },
    ],
  }).lean<TSwipeMatchLean | null>();
};

// Upsert by pairKey so simultaneous mutual likes converge into the same match.
export const createOrGetActiveSwipeMatch = async (params: {
  candidateId: string;
  matchedBy: string;
  targetCandidateId: string;
}) => {
  const pairKey = buildSwipePairKey(params.candidateId, params.targetCandidateId);
  const candidates = pairKey.split('_').map((id) => new Types.ObjectId(id));

  try {
    const match = await Match.findOneAndUpdate(
      { pairKey },
      {
        $setOnInsert: {
          candidates,
          matchedBy: new Types.ObjectId(params.matchedBy),
          pairKey,
          status: MatchStatus.ACTIVE,
        },
      },
      {
        new: true,
        setDefaultsOnInsert: true,
        upsert: true,
      }
    ).lean<TSwipeMatchLean | null>();

    if (!match) {
      throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create match');
    }

    return match;
  } catch (error) {
    if (getDuplicateKeyCode(error) !== 11000) {
      throw error;
    }

    const existingMatch = await Match.findOne({
      pairKey,
      status: MatchStatus.ACTIVE,
    }).lean<TSwipeMatchLean | null>();

    if (!existingMatch) {
      throw error;
    }

    return existingMatch;
  }
};
