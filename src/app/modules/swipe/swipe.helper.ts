import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import { FilterQuery, Types } from 'mongoose';
import { redisClient } from '../../config/redis.config';
import AppError from '../../errorHelpers/AppError';
import {
  ICandidatePreferencePayload,
  ICandidatePreferenceStrictFilters,
  TCandidatePreferenceLean,
} from '../candidate-preference/candidatePreference.interface';
import { getCandidatePreferenceSeedOrThrow } from '../candidate-preference/candidatePreference.helper';
import CandidatePreference from '../candidate-preference/candidatePreference.model';
import { ensureDefaultCandidatePreference } from '../candidate-preference/candidatePreference.service';
import { buildStrictFilters } from '../candidate-preference/candidatePreference.utility';
import { VerificationState } from '../candidate/candidate.interface';
import Candidate from '../candidate/candidate.model';
import { buildCandidateLabels } from '../candidate/candidate.utility';
import { CandidateLinkedUserAccessRole } from '../candidate/linked-user/candidateLinkedUser.interface';
import { LikeSource, LikeType } from '../like/like.interface';
import Like from '../like/like.model';
import { ensureMatchConversation } from '../match/match.helper';
import { MatchStatus } from '../match/match.interface';
import Match from '../match/match.model';
import { PLANS } from '../plan/plan.constant';
import { IPlan, PLAN_KEYS, PlanKey } from '../plan/plan.interface';
import PlanModel from '../plan/plan.model';
import Report from '../report/report.model';
import { ActiveStatus } from '../user/user.interface';
import {
  ISwipeActionResponse,
  ISwipeFeedCandidateLean,
  ISwipeFeedCard,
  ISwipeFeedCursor,
  ISwipeFeedResponse,
  ISwipeFeedScore,
  ISwipeFeedSession,
  TSwipeActionLean,
  TSwipeActionLock,
  TSwipeMatchLean,
  TSwipeQuotaCandidate,
  TSwipePlanQuota,
} from './swipe.interface';

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;
const DHAKA_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;

export const SWIPE_FEED_SESSION_TTL_SECONDS = 15 * 60;
export const MIN_FEED_POOL_SIZE = 80;
export const MAX_FEED_POOL_SIZE = 250;
export const SWIPE_ACTION_LOCK_TTL_SECONDS = 10;

export const FEED_CANDIDATE_SELECT =
  '_id name dateOfBirth gender height religion sect caste relationship_status have_children move_abroad occupation highest_education smoke_status drink_status interests personality bio images address coordinates verification_status isActive user createdAt updatedAt';

const QUOTA_CANDIDATE_SELECT = '_id plan user';

// Reads Mongo duplicate-key errors without depending on a driver-specific type.
const getDuplicateKeyCode = (error: unknown) =>
  (error as { code?: number }).code;

// Falls back to the free plan when an older user has no valid plan key.
const getPlanKeyOrDefault = (plan?: string): PlanKey =>
  PLAN_KEYS.includes(plan as PlanKey) ? (plan as PlanKey) : 'free';

// Keep one shared active-action query so legacy rows without isActive still hide a card.
const getActiveActionQuery = (likedBy: string, likedProfile: string) => ({
  likedBy,
  likedProfile,
  $or: [{ isActive: true }, { isActive: { $exists: false } }],
});

// Positive actions can create a mutual match; PASS only hides the profile.
export const isPositiveSwipeAction = (type: LikeType) =>
  type === LikeType.LIKE || type === LikeType.SUPER_LIKE;

// Sorted pair keys make candidate A/B and B/A resolve to the same match.
export const buildSwipePairKey = (
  firstCandidateId: string,
  secondCandidateId: string
) => [firstCandidateId, secondCandidateId].sort().join('_');

// Keeps two quick taps from processing the same actor-target swipe at once.
export const getSwipeActionLockKey = (
  candidateId: string,
  targetCandidateId: string
) => `swipe_action:${candidateId}:${targetCandidateId}`;

// The product resets normal likes at 00:00 Asia/Dhaka, independent of server timezone.
export const getCurrentLikeQuotaWindowStart = (now = new Date()) => {
  const dhakaDate = new Date(now.getTime() + DHAKA_UTC_OFFSET_MS);

  return new Date(
    Date.UTC(
      dhakaDate.getUTCFullYear(),
      dhakaDate.getUTCMonth(),
      dhakaDate.getUTCDate()
    ) - DHAKA_UTC_OFFSET_MS
  );
};

// Frontend can show this value as the next time normal likes refill.
export const getNextLikeQuotaResetAt = (now = new Date()) =>
  new Date(getCurrentLikeQuotaWindowStart(now).getTime() + 24 * 60 * 60 * 1000);

// Creates a compact cursor token that points to a cached ranked feed session.
export const encodeFeedCursor = (cursor: ISwipeFeedCursor) =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');

// Reads the client cursor safely; invalid cursors are treated as bad requests by the service.
export const decodeFeedCursor = (cursor: string): ISwipeFeedCursor | null => {
  try {
    const parsedCursor = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8')
    ) as Partial<ISwipeFeedCursor>;

    if (
      !parsedCursor.sessionId ||
      typeof parsedCursor.sessionId !== 'string' ||
      typeof parsedCursor.offset !== 'number' ||
      parsedCursor.offset < 0
    ) {
      return null;
    }

    return {
      offset: parsedCursor.offset,
      sessionId: parsedCursor.sessionId,
    };
  } catch {
    return null;
  }
};

// Gives every feed session a short opaque id without exposing candidate ids in the cursor.
export const createFeedSessionId = () => crypto.randomBytes(12).toString('hex');

export const getSwipeFeedSessionKey = (
  candidateId: string,
  sessionId: string
) => `swipe_feed:${candidateId}:${sessionId}`;

// Fetch more than the visible page so scoring can rank a meaningful candidate pool.
export const getFeedPoolSize = (limit: number) =>
  Math.min(MAX_FEED_POOL_SIZE, Math.max(MIN_FEED_POOL_SIZE, limit * 8));

// Merges stored filter flags with defaults so older preference documents still behave safely.
export const getEffectiveStrictFilters = (
  preference: TCandidatePreferenceLean
): ICandidatePreferenceStrictFilters =>
  buildStrictFilters(preference as ICandidatePreferencePayload);

export const getAgeFromDateOfBirth = (dateOfBirth: Date, now = new Date()) =>
  Math.floor((now.getTime() - dateOfBirth.getTime()) / MS_PER_YEAR);

// Converts age boundaries into DOB query limits for MongoDB.
export const getDateBeforeYears = (years: number, now = new Date()) => {
  const result = new Date(now);
  result.setFullYear(result.getFullYear() - years);
  return result;
};

// Quick distance check for location scoring and optional strict location filtering.
export const getDistanceKm = (
  firstCoordinates?: number[],
  secondCoordinates?: number[]
) => {
  if (
    !firstCoordinates ||
    !secondCoordinates ||
    firstCoordinates.length < 2 ||
    secondCoordinates.length < 2
  ) {
    return null;
  }

  const [firstLng, firstLat] = firstCoordinates;
  const [secondLng, secondLat] = secondCoordinates;

  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const latDistance = toRadians(secondLat - firstLat);
  const lngDistance = toRadians(secondLng - firstLng);
  const a =
    Math.sin(latDistance / 2) * Math.sin(latDistance / 2) +
    Math.cos(toRadians(firstLat)) *
      Math.cos(toRadians(secondLat)) *
      Math.sin(lngDistance / 2) *
      Math.sin(lngDistance / 2);

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isValueIncluded = <T extends string>(
  values: T[] | undefined,
  value?: T
) => Boolean(value && values?.includes(value));

const getSharedCount = <T extends string>(
  firstValues: T[] | undefined,
  secondValues: T[] | undefined
) => {
  if (!firstValues?.length || !secondValues?.length) {
    return 0;
  }

  const secondSet = new Set(secondValues);
  return firstValues.filter((value) => secondSet.has(value)).length;
};

const isWithinRange = (
  value: number | undefined,
  min?: number,
  max?: number
) => {
  if (value === undefined) {
    return false;
  }

  if (min !== undefined && value < min) {
    return false;
  }

  if (max !== undefined && value > max) {
    return false;
  }

  return true;
};

// Calculates the recommendation score and explains the strongest reasons to the frontend.
export const scoreFeedCandidate = (params: {
  candidate: ISwipeFeedCandidateLean;
  preference: TCandidatePreferenceLean;
  viewerCandidate: ISwipeFeedCandidateLean;
}): ISwipeFeedScore => {
  const { candidate, preference, viewerCandidate } = params;
  const scoreReasons: string[] = [];
  let matchScore = 0;

  const candidateAge = getAgeFromDateOfBirth(candidate.dateOfBirth);
  const distanceKm = getDistanceKm(
    viewerCandidate.coordinates,
    candidate.coordinates
  );

  if (preference.preferredGenders?.includes(candidate.gender)) {
    matchScore += 30;
    scoreReasons.push('Gender matches your preference');
  }

  if (isWithinRange(candidateAge, preference.ageMin, preference.ageMax)) {
    matchScore += 25;
    scoreReasons.push('Age matches your preference');
  }

  if (isValueIncluded(preference.religions, candidate.religion)) {
    matchScore += 15;
    scoreReasons.push('Religion matches your preference');
  }

  if (isValueIncluded(preference.sects, candidate.sect)) {
    matchScore += 10;
    scoreReasons.push('Sect matches your preference');
  }

  if (isValueIncluded(preference.castes, candidate.caste)) {
    matchScore += 8;
    scoreReasons.push('Caste matches your preference');
  }

  if (
    isWithinRange(candidate.height, preference.heightMin, preference.heightMax)
  ) {
    matchScore += 8;
    scoreReasons.push('Height matches your preference');
  }

  if (
    isValueIncluded(preference.highest_educations, candidate.highest_education)
  ) {
    matchScore += 10;
    scoreReasons.push('Education matches your preference');
  }

  if (isValueIncluded(preference.occupations, candidate.occupation)) {
    matchScore += 8;
    scoreReasons.push('Occupation matches your preference');
  }

  if (
    isValueIncluded(
      preference.relationship_statuses,
      candidate.relationship_status
    )
  ) {
    matchScore += 5;
    scoreReasons.push('Relationship status matches your preference');
  }

  if (isValueIncluded(preference.have_children, candidate.have_children)) {
    matchScore += 5;
    scoreReasons.push('Children preference matches');
  }

  if (isValueIncluded(preference.move_abroad, candidate.move_abroad)) {
    matchScore += 5;
    scoreReasons.push('Move abroad preference matches');
  }

  if (isValueIncluded(preference.smoke_statuses, candidate.smoke_status)) {
    matchScore += 4;
  }

  if (isValueIncluded(preference.drink_statuses, candidate.drink_status)) {
    matchScore += 4;
  }

  const sharedInterestScore = Math.min(
    getSharedCount(preference.interests, candidate.interests) * 2,
    12
  );
  if (sharedInterestScore > 0) {
    matchScore += sharedInterestScore;
    scoreReasons.push('Shared interests');
  }

  const sharedPersonalityScore = Math.min(
    getSharedCount(preference.personality, candidate.personality) * 2,
    12
  );
  if (sharedPersonalityScore > 0) {
    matchScore += sharedPersonalityScore;
    scoreReasons.push('Personality traits match');
  }

  if (
    distanceKm !== null &&
    preference.maxDistanceKm !== undefined &&
    distanceKm <= preference.maxDistanceKm
  ) {
    matchScore += 10;
    scoreReasons.push('Within preferred distance');
  }

  if (
    candidate.verification_status?.admin_verified?.status ===
    VerificationState.APPROVED
  ) {
    matchScore += 10;
    scoreReasons.push('Admin verified profile');
  }

  if ((candidate.images?.length ?? 0) >= 3) {
    matchScore += 8;
  }

  if (candidate.bio?.trim()) {
    matchScore += 5;
  }

  if (!candidate.images?.length) {
    matchScore -= 20;
  }

  if (candidate.religion && candidate.religion === viewerCandidate.religion) {
    matchScore += 3;
  }

  return {
    matchScore: Math.max(0, matchScore),
    scoreReasons: scoreReasons.slice(0, 5),
  };
};

// Enforces strict filters that cannot be expressed well by the current Mongo schema.
export const passesPostQueryStrictFilters = (params: {
  candidate: ISwipeFeedCandidateLean;
  preference: TCandidatePreferenceLean;
  strictFilters: ICandidatePreferenceStrictFilters;
  viewerCandidate: ISwipeFeedCandidateLean;
}) => {
  const { candidate, preference, strictFilters, viewerCandidate } = params;

  if (strictFilters.location && preference.maxDistanceKm !== undefined) {
    const distanceKm = getDistanceKm(
      viewerCandidate.coordinates,
      candidate.coordinates
    );

    if (distanceKm === null || distanceKm > preference.maxDistanceKm) {
      return false;
    }
  }

  return true;
};

// Returns feed cards with safe public profile fields only.
export const buildFeedCard = (
  candidate: ISwipeFeedCandidateLean,
  score: ISwipeFeedScore,
  viewerCandidate?: ISwipeFeedCandidateLean
): ISwipeFeedCard => ({
  _id: candidate._id,
  age: getAgeFromDateOfBirth(candidate.dateOfBirth),
  gender: candidate.gender,
  images: candidate.images ?? [],
  labels: buildCandidateLabels({
    personality: candidate.personality,
    religion: candidate.religion,
  }),
  livesIn: candidate.address?.split(',')[0]?.trim() || undefined,
  distanceKm: viewerCandidate
    ? (getDistanceKm(viewerCandidate.coordinates, candidate.coordinates) ??
      undefined)
    : undefined,
  matchScore: score.matchScore,
  name: candidate.name,
  personality: candidate.personality ?? [],
  religion: candidate.religion,
});

// Keeps Mongo `$in` results in the exact ranked order stored in the feed session.
export const sortCandidatesByIdOrder = (
  candidates: ISwipeFeedCandidateLean[],
  orderedIds: string[]
) => {
  const orderMap = new Map(
    orderedIds.map((candidateId, index) => [candidateId, index])
  );

  return [...candidates].sort(
    (firstCandidate, secondCandidate) =>
      (orderMap.get(firstCandidate._id.toString()) ?? Number.MAX_SAFE_INTEGER) -
      (orderMap.get(secondCandidate._id.toString()) ?? Number.MAX_SAFE_INTEGER)
  );
};

export const toObjectIdList = (ids: (Types.ObjectId | string)[]) =>
  ids.map((id) => new Types.ObjectId(id.toString()));

// Loads or creates preferences for candidates who were created before Phase 1 existed.
export const getFeedPreferenceOrCreateDefault = async (params: {
  candidateGender: ISwipeFeedCandidateLean['gender'];
  candidateId: string;
  createdBy: Types.ObjectId | string;
}) => {
  const { candidateGender, candidateId, createdBy } = params;
  const existingPreference = await CandidatePreference.findOne({
    candidate: candidateId,
  }).lean<TCandidatePreferenceLean | null>();

  if (existingPreference) {
    return existingPreference;
  }

  await getCandidatePreferenceSeedOrThrow(candidateId);

  return ensureDefaultCandidatePreference({
    candidateGender,
    candidateId,
    createdBy,
  }) as unknown as Promise<TCandidatePreferenceLean>;
};

// Adds age and strict preference conditions that MongoDB can handle efficiently.
export const buildCandidateFeedQuery = (params: {
  candidateId: string;
  excludedCandidateIds: Types.ObjectId[];
  preference: TCandidatePreferenceLean;
  relaxed?: boolean;
}) => {
  const {
    candidateId,
    excludedCandidateIds,
    preference,
    relaxed = false,
  } = params;
  const strictFilters = getEffectiveStrictFilters(preference);
  const query: FilterQuery<ISwipeFeedCandidateLean> = {
    _id: { $nin: excludedCandidateIds },
    isActive: ActiveStatus.ACTIVE,
  };

  if (!excludedCandidateIds.some((id) => id.toString() === candidateId)) {
    query._id = {
      $nin: [...excludedCandidateIds, new Types.ObjectId(candidateId)],
    };
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

  if (!relaxed && strictFilters.height) {
    if (
      preference.heightMin !== undefined ||
      preference.heightMax !== undefined
    ) {
      query.height = {};

      if (preference.heightMin !== undefined) {
        query.height.$gte = preference.heightMin;
      }

      if (preference.heightMax !== undefined) {
        query.height.$lte = preference.heightMax;
      }
    }
  }

  if (!relaxed && strictFilters.religion && preference.religions?.length) {
    query.religion = { $in: preference.religions };
  }

  if (!relaxed && strictFilters.caste && preference.castes?.length) {
    query.caste = { $in: preference.castes };
  }

  return query;
};

// Fetches only public feed fields and filters out candidates whose owner account is not verified.
export const findVisibleFeedCandidates = async (params: {
  limit: number;
  query: FilterQuery<ISwipeFeedCandidateLean>;
}) => {
  const { limit, query } = params;
  const candidates = await Candidate.find(query)
    .select(FEED_CANDIDATE_SELECT)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .populate({
      match: {
        isActive: ActiveStatus.ACTIVE,
        isDeleted: false,
        isVerified: true,
      },
      path: 'user',
      select: '_id isActive isDeleted isVerified',
    })
    .lean<ISwipeFeedCandidateLean[]>();

  return candidates.filter((candidate) => Boolean(candidate.user));
};

// Reads a ranked feed session for fast next-page loading.
export const readSwipeFeedSession = async (params: {
  candidateId: string;
  sessionId: string;
}) => {
  if (!redisClient.isOpen) {
    return null;
  }

  try {
    const cachedSession = await redisClient.get(
      getSwipeFeedSessionKey(params.candidateId, params.sessionId)
    );

    return cachedSession
      ? (JSON.parse(cachedSession) as ISwipeFeedSession)
      : null;
  } catch {
    return null;
  }
};

// Stores ranked ids instead of full cards so cached pages stay small and fresh details are reloaded.
export const writeSwipeFeedSession = (params: {
  candidateId: string;
  session: ISwipeFeedSession;
  sessionId: string;
}) => {
  if (!redisClient.isOpen) {
    return false;
  }

  void redisClient
    .set(
      getSwipeFeedSessionKey(params.candidateId, params.sessionId),
      JSON.stringify(params.session),
      { EX: SWIPE_FEED_SESSION_TTL_SECONDS }
    )
    .catch(() => undefined);

  return true;
};

// Rejects invalid candidate ids before the feed/action services query MongoDB.
export const assertValidFeedCandidateId = (candidateId: string) => {
  if (!Types.ObjectId.isValid(candidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }
};

// Loads the acting candidate profile used as the feed viewer and scoring baseline.
export const getViewerCandidateOrThrow = async (candidateId: string) => {
  const candidate = await Candidate.findById(candidateId)
    .select(FEED_CANDIDATE_SELECT)
    .lean<ISwipeFeedCandidateLean | null>();

  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  return candidate;
};

// Builds the exclusion list so feed cards never repeat acted, matched, or reported profiles.
export const getExcludedCandidateIds = async (candidateId: string) => {
  const [existingActions, existingMatches, existingReports] = await Promise.all(
    [
      Like.find({ likedBy: candidateId })
        .select('likedProfile')
        .lean<{ likedProfile: Types.ObjectId }[]>(),
      Match.find({ candidates: candidateId })
        .select('candidates')
        .lean<{ candidates: Types.ObjectId[] }[]>(),
      Report.find({
        $or: [{ reportedBy: candidateId }, { reportedCandidate: candidateId }],
      })
        .select('reportedBy reportedCandidate')
        .lean<
          { reportedBy: Types.ObjectId; reportedCandidate: Types.ObjectId }[]
        >(),
    ]
  );

  const excludedIds = new Set<string>([candidateId]);

  for (const action of existingActions) {
    excludedIds.add(action.likedProfile.toString());
  }

  for (const match of existingMatches) {
    for (const matchedCandidateId of match.candidates) {
      excludedIds.add(matchedCandidateId.toString());
    }
  }

  for (const report of existingReports) {
    excludedIds.add(report.reportedBy.toString());
    excludedIds.add(report.reportedCandidate.toString());
  }

  return toObjectIdList(Array.from(excludedIds));
};

// Applies strict filters that require current viewer data or are awkward in Mongo queries.
export const filterStrictCandidates = (params: {
  candidates: ISwipeFeedCandidateLean[];
  preference: TCandidatePreferenceLean;
  viewerCandidate: ISwipeFeedCandidateLean;
}) => {
  const strictFilters = getEffectiveStrictFilters(params.preference);

  return params.candidates.filter((candidate) =>
    passesPostQueryStrictFilters({
      candidate,
      preference: params.preference,
      strictFilters,
      viewerCandidate: params.viewerCandidate,
    })
  );
};

// Scores and sorts candidates by compatibility, profile richness, and freshness.
export const rankCandidates = (params: {
  candidates: ISwipeFeedCandidateLean[];
  preference: TCandidatePreferenceLean;
  viewerCandidate: ISwipeFeedCandidateLean;
}) => {
  const { candidates, preference, viewerCandidate } = params;

  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreFeedCandidate({ candidate, preference, viewerCandidate }),
    }))
    .sort((firstCandidate, secondCandidate) => {
      if (
        secondCandidate.score.matchScore !== firstCandidate.score.matchScore
      ) {
        return (
          secondCandidate.score.matchScore - firstCandidate.score.matchScore
        );
      }

      const secondImageCount = secondCandidate.candidate.images?.length ?? 0;
      const firstImageCount = firstCandidate.candidate.images?.length ?? 0;
      if (secondImageCount !== firstImageCount) {
        return secondImageCount - firstImageCount;
      }

      return (
        new Date(secondCandidate.candidate.createdAt ?? 0).getTime() -
        new Date(firstCandidate.candidate.createdAt ?? 0).getTime()
      );
    });
};

// Converts a ranked candidate pool into response cards and writes cursor state.
export const buildFeedResponseFromRankedCandidates = (params: {
  candidateId: string;
  limit: number;
  rankedCandidates: ReturnType<typeof rankCandidates>;
  relaxed: boolean;
  relaxedReason?: string;
  viewerCandidate: ISwipeFeedCandidateLean;
}): ISwipeFeedResponse => {
  const {
    candidateId,
    limit,
    rankedCandidates,
    relaxed,
    relaxedReason,
    viewerCandidate,
  } = params;
  const sessionId = createFeedSessionId();
  const candidateIds = rankedCandidates.map(({ candidate }) =>
    candidate._id.toString()
  );
  const session: ISwipeFeedSession = {
    candidateIds,
    createdAt: new Date().toISOString(),
    relaxed,
    relaxedReason,
  };
  const sessionStored =
    candidateIds.length > limit &&
    writeSwipeFeedSession({ candidateId, session, sessionId });
  const nextCursor = sessionStored
    ? encodeFeedCursor({ offset: limit, sessionId })
    : null;

  return {
    cards: rankedCandidates
      .slice(0, limit)
      .map(({ candidate, score }) =>
        buildFeedCard(candidate, score, viewerCandidate)
      ),
    limit,
    nextCursor,
    relaxed,
    ...(relaxedReason ? { relaxedReason } : {}),
  };
};

// Reads a cached feed cursor page; returns null when cache expired so service can rebuild.
export const getFeedFromCachedSession = async (params: {
  candidateId: string;
  cursor: string;
  limit: number;
  viewerCandidate: ISwipeFeedCandidateLean;
}) => {
  const decodedCursor = decodeFeedCursor(params.cursor);
  if (!decodedCursor) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid feed cursor');
  }

  const session = await readSwipeFeedSession({
    candidateId: params.candidateId,
    sessionId: decodedCursor.sessionId,
  });
  if (!session) return null;

  const sliceIds = session.candidateIds.slice(
    decodedCursor.offset,
    decodedCursor.offset + params.limit
  );
  if (!sliceIds.length) {
    return {
      cards: [],
      limit: params.limit,
      nextCursor: null,
      relaxed: session.relaxed,
      ...(session.relaxedReason
        ? { relaxedReason: session.relaxedReason }
        : {}),
    };
  }

  const [preference, candidates] = await Promise.all([
    getFeedPreferenceOrCreateDefault({
      candidateGender: params.viewerCandidate.gender,
      candidateId: params.candidateId,
      createdBy: params.viewerCandidate.user as Types.ObjectId,
    }),
    findVisibleFeedCandidates({
      limit: sliceIds.length,
      query: { _id: { $in: toObjectIdList(sliceIds) } },
    }),
  ]);

  const sortedCandidates = sortCandidatesByIdOrder(candidates, sliceIds);
  const rankedCandidates = sortedCandidates.map((candidate) => ({
    candidate,
    score: scoreFeedCandidate({
      candidate,
      preference,
      viewerCandidate: params.viewerCandidate,
    }),
  }));

  const nextOffset = decodedCursor.offset + params.limit;
  const nextCursor =
    nextOffset < session.candidateIds.length
      ? encodeFeedCursor({
          offset: nextOffset,
          sessionId: decodedCursor.sessionId,
        })
      : null;

  return {
    cards: rankedCandidates.map(({ candidate, score }) =>
      buildFeedCard(candidate, score, params.viewerCandidate)
    ),
    limit: params.limit,
    nextCursor,
    relaxed: session.relaxed,
    ...(session.relaxedReason ? { relaxedReason: session.relaxedReason } : {}),
  };
};

// Blocks read-only linked users from mutating swipe state.
export const assertCanPerformSwipeAction = (
  accessRole: CandidateLinkedUserAccessRole
) => {
  if (accessRole === CandidateLinkedUserAccessRole.VIEWER) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Viewer access cannot perform swipe actions'
    );
  }
};

// Prevents a candidate profile from swiping itself.
export const assertDifferentSwipeCandidates = (
  candidateId: string,
  targetCandidateId: string
) => {
  if (candidateId === targetCandidateId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'You cannot swipe your own candidate profile'
    );
  }
};

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

  const key = getSwipeActionLockKey(
    params.candidateId,
    params.targetCandidateId
  );
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
export const clearSwipeFeedSessionsForCandidate = async (
  candidateId: string
) => {
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

// Loads the candidate plan source while preserving the existing owner-account safety checks.
export const getSwipeQuotaCandidateOrThrow = async (candidateId: string) => {
  const candidate = await Candidate.findById(candidateId)
    .select(QUOTA_CANDIDATE_SELECT)
    .populate({
      path: 'user',
      select: '_id isActive isDeleted',
    })
    .lean<TSwipeQuotaCandidate | null>();

  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  const owner =
    candidate.user && typeof candidate.user === 'object' && 'isActive' in candidate.user
      ? candidate.user
      : null;

  if (!owner || owner.isDeleted || owner.isActive !== ActiveStatus.ACTIVE) {
    throw new AppError(StatusCodes.FORBIDDEN, 'Candidate owner is not active');
  }

  return candidate;
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

// Counts current reset-window LIKE and SUPER_LIKE usage for one candidate.
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

// Builds the quota block returned to the frontend after a swipe action.
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

// Enforces daily like and super-like limits only for positive swipe actions.
export const assertSwipeQuotaAvailable = async (params: {
  candidateId: string;
  plan: TSwipePlanQuota;
  type: LikeType;
}) => {
  const { candidateId, plan, type } = params;

  if (!isPositiveSwipeAction(type)) {
    return;
  }

  const quota = await buildSwipeQuotaResponse({ candidateId, plan });

  if (type === LikeType.LIKE && quota.dailyLikeRemaining <= 0) {
    throw new AppError(
      StatusCodes.TOO_MANY_REQUESTS,
      'Daily like limit reached'
    );
  }

  if (type === LikeType.SUPER_LIKE && quota.superLikeRemaining <= 0) {
    throw new AppError(
      StatusCodes.TOO_MANY_REQUESTS,
      'Super like limit reached'
    );
  }
};

// Finds the active swipe decision from one candidate to another.
export const findExistingSwipeAction = async (params: {
  candidateId: string;
  targetCandidateId: string;
}) =>
  Like.findOne(
    getActiveActionQuery(params.candidateId, params.targetCandidateId)
  ).lean<TSwipeActionLean | null>();

// Inserts a swipe action once, or returns the existing action for safe retries.
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

// Finds an active match between two candidates using pairKey or legacy candidate arrays.
export const findActiveSwipeMatch = async (params: {
  candidateId: string;
  targetCandidateId: string;
}) => {
  const pairKey = buildSwipePairKey(
    params.candidateId,
    params.targetCandidateId
  );

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
  const pairKey = buildSwipePairKey(
    params.candidateId,
    params.targetCandidateId
  );
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
      throw new AppError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        'Failed to create match'
      );
    }

    return ensureMatchConversation(match);
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

    return ensureMatchConversation(existingMatch);
  }
};

// Shapes swipe action responses consistently for new actions and idempotent retries.
export const buildSwipeActionResponse = (params: {
  action: TSwipeActionLean;
  candidateId: string;
  match: TSwipeMatchLean | null;
  quota: ISwipeActionResponse['quota'];
  targetCandidateId: string;
}): ISwipeActionResponse => {
  const { action, candidateId, match, quota, targetCandidateId } = params;
  const pairKey = buildSwipePairKey(candidateId, targetCandidateId);

  return {
    action: {
      _id: action._id,
      actedBy: action.actedBy,
      isActive: action.isActive ?? true,
      likedBy: action.likedBy,
      likedProfile: action.likedProfile,
      source: action.source,
      type: action.type,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
    },
    match: match
      ? {
          _id: match._id,
          candidates: match.candidates,
          conversation: match.conversation,
          matchedBy: match.matchedBy,
          pairKey: match.pairKey ?? pairKey,
          status: match.status ?? MatchStatus.ACTIVE,
          createdAt: match.createdAt,
          updatedAt: match.updatedAt,
        }
      : null,
    matched: Boolean(match),
    quota,
  };
};

// Handles frontend retry behavior for an already-saved swipe action.
export const returnExistingSwipeAction = async (params: {
  action: TSwipeActionLean;
  candidateId: string;
  quota: ISwipeActionResponse['quota'];
  targetCandidateId: string;
  type: LikeType;
}) => {
  const { action, candidateId, quota, targetCandidateId, type } = params;

  if (action.type !== type) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This candidate profile already has a swipe action'
    );
  }

  let match: TSwipeMatchLean | null = null;
  if (isPositiveSwipeAction(type)) {
    const reverseAction = await findPositiveReverseSwipeAction({
      candidateId,
      targetCandidateId,
    });

    if (reverseAction) {
      match = await createOrGetActiveSwipeMatch({
        candidateId,
        matchedBy: candidateId,
        targetCandidateId,
      });
    }
  }

  return buildSwipeActionResponse({
    action,
    candidateId,
    match,
    quota,
    targetCandidateId,
  });
};

// Preserves idempotent retry behavior when the pair is already matched.
export const returnExistingMatchedActionOrThrow = async (params: {
  action: TSwipeActionLean | null;
  candidateId: string;
  match: TSwipeMatchLean;
  quota: ISwipeActionResponse['quota'];
  targetCandidateId: string;
  type: LikeType;
}) => {
  const { action, candidateId, match, quota, targetCandidateId, type } = params;

  if (action?.type === type && isPositiveSwipeAction(type)) {
    return buildSwipeActionResponse({
      action,
      candidateId,
      match: await ensureMatchConversation(match),
      quota,
      targetCandidateId,
    });
  }

  throw new AppError(StatusCodes.CONFLICT, 'This candidate is already matched');
};
