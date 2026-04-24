import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { FilterQuery, Types } from 'mongoose';
import { redisClient } from '../../config/redis.config';
import AppError from '../../errorHelpers/AppError';
import { PLANS } from '../plan/plan.constant';
import { IPlan, PLAN_KEYS, PlanKey } from '../plan/plan.interface';
import PlanModel from '../plan/plan.model';
import { ActiveStatus, IUser } from '../user/user.interface';
import User from '../user/user.model';
import Candidate from '../candidate/candidate.model';
import { CandidateLinkedUserAccessRole } from '../candidate/linked-user/candidateLinkedUser.interface';
import { getActiveLinkedUserAccessOrThrow } from '../candidate/linked-user/candidateLinkedUser.helper';
import { Gender } from '../candidate/candidate.interface';
import CandidatePreference from '../candidate-preference/candidatePreference.model';
import { TCandidatePreferenceLean } from '../candidate-preference/candidatePreference.interface';
import { ensureDefaultCandidatePreference } from '../candidate-preference/candidatePreference.service';
import { getCandidatePreferenceSeedOrThrow } from '../candidate-preference/candidatePreference.helper';
import { LikeType, LikeSource } from '../like/like.interface';
import Like from '../like/like.model';
import { MatchStatus } from '../match/match.interface';
import Match from '../match/match.model';
import Report from '../report/report.model';
import {
  ISwipeActionPayload,
  ISwipeActionResponse,
  ISwipeFeedCandidateLean,
  ISwipeFeedQuery,
  ISwipeFeedResponse,
  ISwipeFeedSession,
} from './swipe.interface';
import {
  buildSwipePairKey,
  buildFeedCard,
  createFeedSessionId,
  decodeFeedCursor,
  encodeFeedCursor,
  getEffectiveStrictFilters,
  getFeedPoolSize,
  isPositiveSwipeAction,
  passesPostQueryStrictFilters,
  scoreFeedCandidate,
  sortCandidatesByIdOrder,
  toObjectIdList,
  getCurrentLikeQuotaWindowStart,
  getNextLikeQuotaResetAt,
  getSwipeActionLockKey,
  getSwipeFeedSessionKey,
  SWIPE_FEED_SESSION_TTL_SECONDS,
  SWIPE_ACTION_LOCK_TTL_SECONDS,
} from './swipe.utility';


// ============================================================================
// TYPE DEFINITIONS & CONSTANTS
// ============================================================================

const USER_QUOTA_SELECT = '_id plan dailyLikeRemaining superLikeRemaining lastLikeReset isActive isDeleted';
const FEED_CANDIDATE_SELECT = '_id name dateOfBirth gender height religion sect caste relationship_status have_children move_abroad occupation highest_education smoke_status drink_status interests personality bio images address coordinates verification_status isActive user createdAt updatedAt';
const RELAXED_FEED_REASON = 'Not enough candidates matched all strict preferences';

interface TSwipeActionLean {
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

interface TSwipeMatchLean {
  _id: Types.ObjectId;
  candidates: Types.ObjectId[];
  conversation?: Types.ObjectId;
  matchedBy?: Types.ObjectId;
  pairKey: string;
  status: MatchStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

interface TSwipeQuotaUser extends Pick<IUser, '_id' | 'dailyLikeRemaining' | 'isActive' | 'isDeleted' | 'lastLikeReset' | 'plan' | 'superLikeRemaining'> {
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

// ============================================================================
// VALIDATION & ACCESS CONTROL
// ============================================================================

const assertValidFeedCandidateId = (candidateId: string) => {
  if (!Types.ObjectId.isValid(candidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }
};

const assertCanPerformSwipeAction = (accessRole: CandidateLinkedUserAccessRole) => {
  if (accessRole === CandidateLinkedUserAccessRole.VIEWER) {
    throw new AppError(StatusCodes.FORBIDDEN, 'Viewer access cannot perform swipe actions');
  }
};

const assertDifferentSwipeCandidates = (candidateId: string, targetCandidateId: string) => {
  if (candidateId === targetCandidateId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'You cannot swipe your own candidate profile');
  }
};

// ============================================================================
// DATABASE: FEED QUERIES
// ============================================================================

const buildCandidateFeedQuery = (params: {
  candidateId: string;
  excludedCandidateIds: Types.ObjectId[];
  preference: TCandidatePreferenceLean;
  relaxed?: boolean;
}) => {
  const { candidateId, excludedCandidateIds, preference, relaxed = false } = params;
  const strictFilters = getEffectiveStrictFilters(preference);
  const query: FilterQuery<ISwipeFeedCandidateLean> = {
    _id: { $nin: excludedCandidateIds },
    isActive: ActiveStatus.ACTIVE,
  };

  if (!excludedCandidateIds.some((id) => id.toString() === candidateId)) {
    query._id = { $nin: [...excludedCandidateIds, new Types.ObjectId(candidateId)] };
  }

  if (!relaxed && strictFilters.gender && preference.preferredGenders?.length) {
    query.gender = { $in: preference.preferredGenders };
  }

  if (preference.ageMin !== undefined || preference.ageMax !== undefined) {
    query.dateOfBirth = {};
    if (preference.ageMin !== undefined) {
      query.dateOfBirth.$lte = getDateBeforeYears(preference.ageMin);
    }
    if (preference.ageMax !== undefined) {
      query.dateOfBirth.$gt = getDateBeforeYears(preference.ageMax + 1);
    }
  }

  if (!relaxed && strictFilters.height && (preference.heightMin !== undefined || preference.heightMax !== undefined)) {
    query.height = {};
    if (preference.heightMin !== undefined) query.height.$gte = preference.heightMin;
    if (preference.heightMax !== undefined) query.height.$lte = preference.heightMax;
  }

  if (!relaxed && strictFilters.religion && preference.religions?.length) {
    query.religion = { $in: preference.religions };
  }

  if (!relaxed && strictFilters.caste && preference.castes?.length) {
    query.caste = { $in: preference.castes };
  }

  return query;
};

const findVisibleFeedCandidates = async (params: { limit: number; query: FilterQuery<ISwipeFeedCandidateLean> }) => {
  const { limit, query } = params;
  const candidates = await Candidate.find(query)
    .select(FEED_CANDIDATE_SELECT)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .populate({
      match: { isActive: ActiveStatus.ACTIVE, isDeleted: false, isVerified: true },
      path: 'user',
      select: '_id isActive isDeleted isVerified',
    })
    .lean<ISwipeFeedCandidateLean[]>();

  return candidates.filter((candidate) => Boolean(candidate.user));
};

const getViewerCandidateOrThrow = async (candidateId: string) => {
  const candidate = await Candidate.findById(candidateId).select(FEED_CANDIDATE_SELECT).lean<ISwipeFeedCandidateLean | null>();
  if (!candidate) throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  return candidate;
};

const getFeedPreferenceOrCreateDefault = async (params: { candidateGender: Gender | string; candidateId: string; createdBy: Types.ObjectId | string }) => {
  const { candidateGender, candidateId, createdBy } = params;
  const existingPreference = await CandidatePreference.findOne({ candidate: candidateId }).lean<TCandidatePreferenceLean | null>();

  if (existingPreference) return existingPreference;

  await getCandidatePreferenceSeedOrThrow(candidateId);
  return (await ensureDefaultCandidatePreference({ candidateGender: candidateGender as Gender, candidateId, createdBy })) as TCandidatePreferenceLean;
};

// ============================================================================
// DATABASE: SWIPE ACTION QUERIES
// ============================================================================

const getSwipeTargetCandidateOrThrow = async (targetCandidateId: string) => {
  const targetCandidate = await Candidate.findOne({ _id: targetCandidateId, isActive: ActiveStatus.ACTIVE })
    .select('_id user isActive')
    .populate({ match: { isActive: ActiveStatus.ACTIVE, isDeleted: false, isVerified: true }, path: 'user', select: '_id isActive isDeleted isVerified' })
    .lean<{ _id: Types.ObjectId; isActive: ActiveStatus; user: Types.ObjectId | null } | null>();

  if (!targetCandidate) throw new AppError(StatusCodes.NOT_FOUND, 'Target candidate not found');
  if (!targetCandidate.user) throw new AppError(StatusCodes.FORBIDDEN, 'Target candidate is not available for swipe');
  return targetCandidate;
};

const assertNoSwipeReportBetweenCandidates = async (params: { candidateId: string; targetCandidateId: string }) => {
  const report = await Report.exists({
    $or: [
      { reportedBy: params.candidateId, reportedCandidate: params.targetCandidateId },
      { reportedBy: params.targetCandidateId, reportedCandidate: params.candidateId },
    ],
  });

  if (report) throw new AppError(StatusCodes.FORBIDDEN, 'Swipe action is blocked because a report exists between these candidates');
};

const findExistingSwipeAction = async (params: { candidateId: string; targetCandidateId: string }) =>
  Like.findOne({ likedBy: params.candidateId, likedProfile: params.targetCandidateId, $or: [{ isActive: true }, { isActive: { $exists: false } }] }).lean<TSwipeActionLean | null>();

const findPositiveReverseSwipeAction = async (params: { candidateId: string; targetCandidateId: string }) =>
  Like.findOne({
    likedBy: params.targetCandidateId,
    likedProfile: params.candidateId,
    type: { $in: [LikeType.LIKE, LikeType.SUPER_LIKE] },
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  }).lean<TSwipeActionLean | null>();

const findActiveSwipeMatch = async (params: { candidateId: string; targetCandidateId: string }) => {
  const pairKey = buildSwipePairKey(params.candidateId, params.targetCandidateId);
  return Match.findOne({
    $or: [
      { pairKey, status: MatchStatus.ACTIVE },
      { candidates: { $all: [new Types.ObjectId(params.candidateId), new Types.ObjectId(params.targetCandidateId)] }, $or: [{ status: MatchStatus.ACTIVE }, { status: { $exists: false } }] },
    ],
  }).lean<TSwipeMatchLean | null>();
};

// ============================================================================
// QUOTA MANAGEMENT
// ============================================================================

const getSwipeQuotaOwnerOrThrow = async (ownerUserId: string) => {
  const owner = await User.findById(ownerUserId).select(USER_QUOTA_SELECT).lean<TSwipeQuotaUser | null>();
  if (!owner) throw new AppError(StatusCodes.NOT_FOUND, 'Candidate owner not found');
  if (owner.isDeleted || owner.isActive !== ActiveStatus.ACTIVE) throw new AppError(StatusCodes.FORBIDDEN, 'Candidate owner is not active');
  return owner;
};

const getSwipePlanOrDefault = async (plan?: string): Promise<TSwipePlanQuota> => {
  const planKey = (PLAN_KEYS.includes(plan as PlanKey) ? plan : 'free') as PlanKey;
  const planDocument = await PlanModel.findOne({ isActive: true, key: planKey }).select('dailyLikes superLikes').lean<Pick<IPlan, 'dailyLikes' | 'superLikes'> | null>();
  return planDocument ?? PLANS[planKey];
};

const resetDailyLikeQuotaIfNeeded = async (params: { now?: Date; plan: TSwipePlanQuota; user: TSwipeQuotaUser }) => {
  const { now = new Date(), plan, user } = params;
  const currentWindowStart = getCurrentLikeQuotaWindowStart(now);
  const shouldReset = !user.lastLikeReset || user.lastLikeReset < currentWindowStart || user.dailyLikeRemaining === undefined;

  if (!shouldReset) return user;

  const updatedUser = await User.findByIdAndUpdate(user._id, { $set: { dailyLikeRemaining: plan.dailyLikes, lastLikeReset: currentWindowStart } }, { new: true })
    .select(USER_QUOTA_SELECT)
    .lean<TSwipeQuotaUser | null>();

  if (!updatedUser) throw new AppError(StatusCodes.NOT_FOUND, 'Candidate owner not found');
  return updatedUser;
};

const consumeSwipeQuotaOrThrow = async (params: { type: LikeType; userId: Types.ObjectId }) => {
  const { type, userId } = params;

  if (type === LikeType.LIKE) {
    const updatedUser = await User.findOneAndUpdate({ _id: userId, dailyLikeRemaining: { $gt: 0 } }, { $inc: { dailyLikeRemaining: -1 } }, { new: true })
      .select(USER_QUOTA_SELECT)
      .lean<TSwipeQuotaUser | null>();
    if (!updatedUser) throw new AppError(StatusCodes.TOO_MANY_REQUESTS, 'Daily like limit reached');
    return updatedUser;
  }

  if (type === LikeType.SUPER_LIKE) {
    const updatedUser = await User.findOneAndUpdate({ _id: userId, superLikeRemaining: { $gt: 0 } }, { $inc: { superLikeRemaining: -1 } }, { new: true })
      .select(USER_QUOTA_SELECT)
      .lean<TSwipeQuotaUser | null>();
    if (!updatedUser) throw new AppError(StatusCodes.TOO_MANY_REQUESTS, 'Super like limit reached');
    return updatedUser;
  }

  return getSwipeQuotaOwnerOrThrow(userId.toString());
};

const refundSwipeQuota = (params: { type: LikeType; userId: Types.ObjectId }) => {
  const { type, userId } = params;
  if (type === LikeType.LIKE) return User.findByIdAndUpdate(userId, { $inc: { dailyLikeRemaining: 1 } });
  if (type === LikeType.SUPER_LIKE) return User.findByIdAndUpdate(userId, { $inc: { superLikeRemaining: 1 } });
  return Promise.resolve(null);
};

const buildSwipeQuotaResponse = (user: TSwipeQuotaUser, now = new Date()) => ({
  dailyLikeRemaining: user.dailyLikeRemaining ?? 0,
  nextResetAt: getNextLikeQuotaResetAt(now),
  superLikeRemaining: user.superLikeRemaining ?? 0,
});

const getDateBeforeYears = (years: number, now = new Date()) => {
  const result = new Date(now);
  result.setFullYear(result.getFullYear() - years);
  return result;
};

// ============================================================================
// SWIPE ACTION: CREATE & MATCH
// ============================================================================

const createSwipeActionOrGetExisting = async (params: { actedBy: string; candidateId: string; source: LikeSource; targetCandidateId: string; type: LikeType }) => {
  try {
    const action = await Like.create({
      actedBy: params.actedBy,
      isActive: true,
      likedBy: params.candidateId,
      likedProfile: params.targetCandidateId,
      source: params.source,
      type: params.type,
    });
    return { action: action.toObject() as TSwipeActionLean, created: true };
  } catch (error: unknown) {
    const code = (error as { code?: number }).code;
    if (code !== 11000) throw error;

    const existingAction = await findExistingSwipeAction(params);
    if (!existingAction) throw error;
    return { action: existingAction, created: false };
  }
};

const createOrGetActiveSwipeMatch = async (params: { candidateId: string; matchedBy: string; targetCandidateId: string }) => {
  const pairKey = buildSwipePairKey(params.candidateId, params.targetCandidateId);
  const candidates = pairKey.split('_').map((id) => new Types.ObjectId(id));

  try {
    const match = await Match.findOneAndUpdate(
      { pairKey },
      { $setOnInsert: { candidates, matchedBy: new Types.ObjectId(params.matchedBy), pairKey, status: MatchStatus.ACTIVE } },
      { new: true, setDefaultsOnInsert: true, upsert: true }
    ).lean<TSwipeMatchLean | null>();

    if (!match) throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create match');
    return match;
  } catch (error: unknown) {
    const code = (error as { code?: number }).code;
    if (code !== 11000) throw error;

    const existingMatch = await Match.findOne({ pairKey, status: MatchStatus.ACTIVE }).lean<TSwipeMatchLean | null>();
    if (!existingMatch) throw error;
    return existingMatch;
  }
};

// ============================================================================
// LOCKING & CACHE MANAGEMENT
// ============================================================================

const acquireSwipeActionLock = async (params: { candidateId: string; targetCandidateId: string }): Promise<TSwipeActionLock | null> => {
  if (!redisClient.isOpen) return null;

  const key = getSwipeActionLockKey(params.candidateId, params.targetCandidateId);
  const token = crypto.randomBytes(8).toString('hex');

  try {
    const acquired = await redisClient.set(key, token, { EX: SWIPE_ACTION_LOCK_TTL_SECONDS, NX: true });
    if (!acquired) throw new AppError(StatusCodes.CONFLICT, 'Swipe action is already being processed');
    return { key, token };
  } catch (error) {
    if (error instanceof AppError) throw error;
    return null;
  }
};

const releaseSwipeActionLock = async (lock: TSwipeActionLock | null) => {
  if (!lock || !redisClient.isOpen) return;
  try {
    const currentToken = await redisClient.get(lock.key);
    if (currentToken === lock.token) await redisClient.del(lock.key);
  } catch {
    // Lock cleanup must never turn a successful swipe into a failed response.
  }
};

const readSwipeFeedSession = async (params: { candidateId: string; sessionId: string }) => {
  if (!redisClient.isOpen) return null;
  try {
    const cachedSession = await redisClient.get(getSwipeFeedSessionKey(params.candidateId, params.sessionId));
    return cachedSession ? (JSON.parse(cachedSession) as ISwipeFeedSession) : null;
  } catch {
    return null;
  }
};

const writeSwipeFeedSession = (params: { candidateId: string; session: ISwipeFeedSession; sessionId: string }) => {
  if (!redisClient.isOpen) return false;
  void redisClient.set(getSwipeFeedSessionKey(params.candidateId, params.sessionId), JSON.stringify(params.session), { EX: SWIPE_FEED_SESSION_TTL_SECONDS }).catch(() => undefined);
  return true;
};

const clearSwipeFeedSessionsForCandidate = async (candidateId: string) => {
  if (!redisClient.isOpen) return;
  try {
    let cursor = '0';
    do {
      const { cursor: nextCursor, keys } = await redisClient.scan(cursor, { COUNT: 100, MATCH: `swipe_feed:${candidateId}:*` });
      cursor = nextCursor;
      if (keys.length) await redisClient.del(keys);
    } while (cursor !== '0');
  } catch {
    // Feed cache is disposable; DB actions remain the source of truth.
  }
};

// ============================================================================
// FEED BUILDING HELPERS
// ============================================================================

const getExcludedCandidateIds = async (candidateId: string) => {
  const [existingActions, existingMatches, existingReports] = await Promise.all([
    Like.find({ likedBy: candidateId }).select('likedProfile').lean<{ likedProfile: Types.ObjectId }[]>(),
    Match.find({ candidates: candidateId }).select('candidates').lean<{ candidates: Types.ObjectId[] }[]>(),
    Report.find({ $or: [{ reportedBy: candidateId }, { reportedCandidate: candidateId }] }).select('reportedBy reportedCandidate').lean<{ reportedBy: Types.ObjectId; reportedCandidate: Types.ObjectId }[]>(),
  ]);

  const excludedIds = new Set<string>([candidateId]);
  for (const action of existingActions) excludedIds.add(action.likedProfile.toString());
  for (const match of existingMatches) {
    for (const matchedCandidateId of match.candidates) excludedIds.add(matchedCandidateId.toString());
  }
  for (const report of existingReports) {
    excludedIds.add(report.reportedBy.toString());
    excludedIds.add(report.reportedCandidate.toString());
  }

  return toObjectIdList(Array.from(excludedIds));
};

const filterStrictCandidates = (params: { candidates: ISwipeFeedCandidateLean[]; preference: TCandidatePreferenceLean; viewerCandidate: ISwipeFeedCandidateLean }) => {
  const strictFilters = getEffectiveStrictFilters(params.preference);
  return params.candidates.filter((candidate) => passesPostQueryStrictFilters({ candidate, preference: params.preference, strictFilters, viewerCandidate: params.viewerCandidate }));
};

const rankCandidates = (params: { candidates: ISwipeFeedCandidateLean[]; preference: TCandidatePreferenceLean; viewerCandidate: ISwipeFeedCandidateLean }) => {
  const { candidates, preference, viewerCandidate } = params;
  return candidates
    .map((candidate) => ({ candidate, score: scoreFeedCandidate({ candidate, preference, viewerCandidate }) }))
    .sort((firstCandidate, secondCandidate) => {
      if (secondCandidate.score.matchScore !== firstCandidate.score.matchScore) return secondCandidate.score.matchScore - firstCandidate.score.matchScore;
      const secondImageCount = secondCandidate.candidate.images?.length ?? 0;
      const firstImageCount = firstCandidate.candidate.images?.length ?? 0;
      if (secondImageCount !== firstImageCount) return secondImageCount - firstImageCount;
      return new Date(secondCandidate.candidate.createdAt ?? 0).getTime() - new Date(firstCandidate.candidate.createdAt ?? 0).getTime();
    });
};

const buildFeedResponseFromRankedCandidates = (params: { candidateId: string; limit: number; rankedCandidates: ReturnType<typeof rankCandidates>; relaxed: boolean; relaxedReason?: string; viewerCandidate: ISwipeFeedCandidateLean }): ISwipeFeedResponse => {
  const { candidateId, limit, rankedCandidates, relaxed, relaxedReason, viewerCandidate } = params;
  const sessionId = createFeedSessionId();
  const candidateIds = rankedCandidates.map(({ candidate }) => candidate._id.toString());
  const session: ISwipeFeedSession = { candidateIds, createdAt: new Date().toISOString(), relaxed, relaxedReason };
  const sessionStored = candidateIds.length > limit && writeSwipeFeedSession({ candidateId, session, sessionId });
  const nextCursor = sessionStored ? encodeFeedCursor({ offset: limit, sessionId }) : null;

  return {
    cards: rankedCandidates.slice(0, limit).map(({ candidate, score }) => buildFeedCard(candidate, score, viewerCandidate)),
    limit,
    nextCursor,
    relaxed,
    ...(relaxedReason ? { relaxedReason } : {}),
  };
};

const getFeedFromCachedSession = async (params: { candidateId: string; cursor: string; limit: number; viewerCandidate: ISwipeFeedCandidateLean }) => {
  const decodedCursor = decodeFeedCursor(params.cursor);
  if (!decodedCursor) throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid feed cursor');

  const session = await readSwipeFeedSession({ candidateId: params.candidateId, sessionId: decodedCursor.sessionId });
  if (!session) return null;

  const sliceIds = session.candidateIds.slice(decodedCursor.offset, decodedCursor.offset + params.limit);
  if (!sliceIds.length) {
    return {
      cards: [],
      limit: params.limit,
      nextCursor: null,
      relaxed: session.relaxed,
      ...(session.relaxedReason ? { relaxedReason: session.relaxedReason } : {}),
    };
  }

  const [preference, candidates] = await Promise.all([
    getFeedPreferenceOrCreateDefault({ candidateGender: params.viewerCandidate.gender, candidateId: params.candidateId, createdBy: params.viewerCandidate.user as Types.ObjectId }),
    findVisibleFeedCandidates({ limit: sliceIds.length, query: { _id: { $in: toObjectIdList(sliceIds) } } }),
  ]);

  const sortedCandidates = sortCandidatesByIdOrder(candidates, sliceIds);
  const rankedCandidates = sortedCandidates.map((candidate) => ({ candidate, score: scoreFeedCandidate({ candidate, preference, viewerCandidate: params.viewerCandidate }) }));

  const nextOffset = decodedCursor.offset + params.limit;
  const nextCursor = nextOffset < session.candidateIds.length ? encodeFeedCursor({ offset: nextOffset, sessionId: decodedCursor.sessionId }) : null;

  return {
    cards: rankedCandidates.map(({ candidate, score }) => buildFeedCard(candidate, score, params.viewerCandidate)),
    limit: params.limit,
    nextCursor,
    relaxed: session.relaxed,
    ...(session.relaxedReason ? { relaxedReason: session.relaxedReason } : {}),
  };
};

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

const buildSwipeActionResponse = (params: { action: TSwipeActionLean; candidateId: string; match: TSwipeMatchLean | null; quota: ISwipeActionResponse['quota']; targetCandidateId: string }): ISwipeActionResponse => {
  const { action, candidateId, match, quota, targetCandidateId } = params;
  const pairKey = buildSwipePairKey(candidateId, targetCandidateId);

  return {
    action: { _id: action._id, actedBy: action.actedBy, isActive: action.isActive ?? true, likedBy: action.likedBy, likedProfile: action.likedProfile, source: action.source, type: action.type, createdAt: action.createdAt, updatedAt: action.updatedAt },
    match: match
      ? { _id: match._id, candidates: match.candidates, conversation: match.conversation, matchedBy: match.matchedBy, pairKey: match.pairKey ?? pairKey, status: match.status ?? MatchStatus.ACTIVE, createdAt: match.createdAt, updatedAt: match.updatedAt }
      : null,
    matched: Boolean(match),
    quota,
  };
};

const returnExistingSwipeAction = async (params: { action: TSwipeActionLean; candidateId: string; quota: ISwipeActionResponse['quota']; targetCandidateId: string; type: LikeType }) => {
  const { action, candidateId, quota, targetCandidateId, type } = params;

  if (action.type !== type) throw new AppError(StatusCodes.CONFLICT, 'This candidate profile already has a swipe action');

  let match: TSwipeMatchLean | null = null;
  if (isPositiveSwipeAction(type)) {
    const reverseAction = await findPositiveReverseSwipeAction({ candidateId, targetCandidateId });
    if (reverseAction) {
      match = await createOrGetActiveSwipeMatch({ candidateId, matchedBy: candidateId, targetCandidateId });
    }
  }

  return buildSwipeActionResponse({ action, candidateId, match, quota, targetCandidateId });
};

const getQuotaContextForSwipeAction = async (ownerUserId: string) => {
  const owner = await getSwipeQuotaOwnerOrThrow(ownerUserId);
  const plan = await getSwipePlanOrDefault(owner.plan);
  const resetOwner = await resetDailyLikeQuotaIfNeeded({ plan, user: owner });
  return { owner: resetOwner, plan };
};

// ============================================================================
// PUBLIC API METHODS
// ============================================================================
// ============================================================================
// PUBLIC API METHODS
// ============================================================================

/**
 * GET /swipes/feed - Returns ranked candidate stack for Tinder-style discovery.
 * Cached sessions enable fast pagination without re-ranking.
 */
const getSwipeFeed = async (userId: string, query: ISwipeFeedQuery): Promise<ISwipeFeedResponse> => {
  assertValidFeedCandidateId(query.candidateId);
  
  // Linked access allows OWNER/EDITOR/VIEWER to view feed
  await getActiveLinkedUserAccessOrThrow({ candidateId: query.candidateId, userId });

  const viewerCandidate = await getViewerCandidateOrThrow(query.candidateId);

  // Try loading from cached session for fast pagination
  if (query.cursor) {
    const cachedResponse = await getFeedFromCachedSession({ candidateId: query.candidateId, cursor: query.cursor, limit: query.limit, viewerCandidate });
    if (cachedResponse) return cachedResponse;
  }

  // Build fresh feed with strict and relaxed filtering
  const [preference, excludedCandidateIds] = await Promise.all([
    getFeedPreferenceOrCreateDefault({ candidateGender: viewerCandidate.gender, candidateId: query.candidateId, createdBy: viewerCandidate.user as Types.ObjectId }),
    getExcludedCandidateIds(query.candidateId),
  ]);

  const poolSize = getFeedPoolSize(query.limit);
  const strictQuery = buildCandidateFeedQuery({ candidateId: query.candidateId, excludedCandidateIds, preference });
  const strictCandidates = filterStrictCandidates({
    candidates: await findVisibleFeedCandidates({ limit: poolSize, query: strictQuery }),
    preference,
    viewerCandidate,
  });

  let feedCandidates = strictCandidates;
  let relaxed = false;
  let relaxedReason: string | undefined;

  // If not enough strict candidates, relax filters and add more
  if (strictCandidates.length < query.limit) {
    relaxed = true;
    relaxedReason = RELAXED_FEED_REASON;

    const alreadySelectedIds = toObjectIdList([...excludedCandidateIds.map((id) => id.toString()), ...strictCandidates.map((candidate) => candidate._id.toString())]);
    const relaxedQuery = buildCandidateFeedQuery({ candidateId: query.candidateId, excludedCandidateIds: alreadySelectedIds, preference, relaxed: true });
    const relaxedCandidates = await findVisibleFeedCandidates({ limit: poolSize, query: relaxedQuery });
    feedCandidates = [...strictCandidates, ...relaxedCandidates];
  }

  return buildFeedResponseFromRankedCandidates({
    candidateId: query.candidateId,
    limit: query.limit,
    rankedCandidates: rankCandidates({ candidates: feedCandidates, preference, viewerCandidate }),
    relaxed,
    relaxedReason,
    viewerCandidate,
  });
};

/**
 * POST /swipes/action - Process LIKE/SUPER_LIKE/PASS and create match on mutual positive swipes.
 * Quota consumption is atomic to prevent double-spending.
 */
const performSwipeAction = async (userId: string, payload: ISwipeActionPayload): Promise<ISwipeActionResponse> => {
  assertValidFeedCandidateId(payload.candidateId);
  assertValidFeedCandidateId(payload.targetCandidateId);
  assertDifferentSwipeCandidates(payload.candidateId, payload.targetCandidateId);

  const { access, candidate } = await getActiveLinkedUserAccessOrThrow({ candidateId: payload.candidateId, userId });
  assertCanPerformSwipeAction(access.accessRole);

  // Acquire Redis lock to prevent double-tap race conditions
  const lock = await acquireSwipeActionLock({ candidateId: payload.candidateId, targetCandidateId: payload.targetCandidateId });

  try {
    // Validate target exists and no report blocks interaction
    await Promise.all([
      getSwipeTargetCandidateOrThrow(payload.targetCandidateId),
      assertNoSwipeReportBetweenCandidates({ candidateId: payload.candidateId, targetCandidateId: payload.targetCandidateId }),
    ]);

    // Get quota context and reset daily likes if needed
    const { owner } = await getQuotaContextForSwipeAction(candidate.user.toString());
    let quotaOwner = owner;
    const currentQuota = () => buildSwipeQuotaResponse(quotaOwner);

    // Check for existing action and match
    const [existingAction, existingMatch] = await Promise.all([
      findExistingSwipeAction({ candidateId: payload.candidateId, targetCandidateId: payload.targetCandidateId }),
      findActiveSwipeMatch({ candidateId: payload.candidateId, targetCandidateId: payload.targetCandidateId }),
    ]);

    // Can't swipe if already matched
    if (existingMatch) {
      if (existingAction && existingAction.type === payload.type && isPositiveSwipeAction(payload.type)) {
        return buildSwipeActionResponse({ action: existingAction, candidateId: payload.candidateId, match: existingMatch, quota: currentQuota(), targetCandidateId: payload.targetCandidateId });
      }
      throw new AppError(StatusCodes.CONFLICT, 'This candidate is already matched');
    }

    // Return existing action if already swiped
    if (existingAction) {
      return returnExistingSwipeAction({ action: existingAction, candidateId: payload.candidateId, quota: currentQuota(), targetCandidateId: payload.targetCandidateId, type: payload.type });
    }

    // Consume quota for positive swipes (LIKE/SUPER_LIKE)
    let quotaConsumed = false;
    if (isPositiveSwipeAction(payload.type)) {
      quotaOwner = await consumeSwipeQuotaOrThrow({ type: payload.type, userId: quotaOwner._id as Types.ObjectId });
      quotaConsumed = true;
    }

    // Create the swipe action
    const { action, created } = await createSwipeActionOrGetExisting({
      actedBy: userId,
      candidateId: payload.candidateId,
      source: payload.source,
      targetCandidateId: payload.targetCandidateId,
      type: payload.type,
    });

    // If duplicate write won due to race, refund quota
    if (!created) {
      if (quotaConsumed) {
        await refundSwipeQuota({ type: payload.type, userId: quotaOwner._id as Types.ObjectId });
        quotaOwner = await getSwipeQuotaOwnerOrThrow((quotaOwner._id as Types.ObjectId).toString());
      }
      return returnExistingSwipeAction({ action, candidateId: payload.candidateId, quota: currentQuota(), targetCandidateId: payload.targetCandidateId, type: payload.type });
    }

    // Check for mutual like and create match
    let match: TSwipeMatchLean | null = null;
    if (isPositiveSwipeAction(payload.type)) {
      const reverseAction = await findPositiveReverseSwipeAction({ candidateId: payload.candidateId, targetCandidateId: payload.targetCandidateId });
      if (reverseAction) {
        match = await createOrGetActiveSwipeMatch({ candidateId: payload.candidateId, matchedBy: payload.candidateId, targetCandidateId: payload.targetCandidateId });
      }
    }

    // Invalidate feed cache asynchronously
    void clearSwipeFeedSessionsForCandidate(payload.candidateId).catch(() => undefined);

    return buildSwipeActionResponse({ action, candidateId: payload.candidateId, match, quota: currentQuota(), targetCandidateId: payload.targetCandidateId });
  } finally {
    await releaseSwipeActionLock(lock);
  }
};

export const SwipeService = {
  getSwipeFeed,
  performSwipeAction,
};
