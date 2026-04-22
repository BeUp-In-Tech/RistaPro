import { StatusCodes } from 'http-status-codes';
import { FilterQuery, Types } from 'mongoose';
import { redisClient } from '../../config/redis.config';
import AppError from '../../errorHelpers/AppError';
import { ActiveStatus } from '../user/user.interface';
import { TCandidatePreferenceLean } from '../candidate-preference/candidatePreference.interface';
import { getCandidatePreferenceSeedOrThrow } from '../candidate-preference/candidatePreference.helper';
import { ensureDefaultCandidatePreference } from '../candidate-preference/candidatePreference.service';
import CandidatePreference from '../candidate-preference/candidatePreference.model';
import Candidate from '../candidate/candidate.model';
import {
  ISwipeFeedCandidateLean,
  ISwipeFeedSession,
} from './swipe.interface';
import {
  getDateBeforeYears,
  getEffectiveStrictFilters,
  getSwipeFeedSessionKey,
  SWIPE_FEED_SESSION_TTL_SECONDS,
} from './swipe.utility';

export const FEED_CANDIDATE_SELECT =
  '_id name dateOfBirth gender height religion sect caste relationship_status have_children move_abroad occupation highest_education smoke_status drink_status interests personality bio images address coordinates verification_status isActive user createdAt updatedAt';

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
  const { candidateId, excludedCandidateIds, preference, relaxed = false } = params;
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

  if (
    !relaxed &&
    strictFilters.gender &&
    preference.preferredGenders?.length
  ) {
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
    if (preference.heightMin !== undefined || preference.heightMax !== undefined) {
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

export const assertValidFeedCandidateId = (candidateId: string) => {
  if (!Types.ObjectId.isValid(candidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }
};
