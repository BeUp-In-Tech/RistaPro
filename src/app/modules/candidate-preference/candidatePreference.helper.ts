import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import { redisClient } from '../../config/redis.config';
import AppError from '../../errorHelpers/AppError';
import { Gender } from '../candidate/candidate.interface';
import Candidate from '../candidate/candidate.model';
import {
  CandidateLinkedUserAccessRole,
  TActiveLinkedUserLean,
} from '../candidate/linked-user/candidateLinkedUser.interface';
import { ActiveStatus } from '../user/user.interface';
import { ICandidatePreferencePayload } from './candidatePreference.interface';
import {
  CANDIDATE_PREFERENCE_CACHE_TTL_SECONDS,
  getCandidatePreferenceCacheKey,
} from './candidatePreference.utility';

interface TCandidatePreferenceSeed {
  _id: Types.ObjectId;
  gender: Gender;
  isActive: ActiveStatus;
  user: Types.ObjectId;
}

export const PREFERENCE_RESPONSE_SELECT =
  '_id candidate preferredGenders ageMin ageMax heightMin heightMax religions sects castes relationship_statuses have_children move_abroad occupations highest_educations smoke_statuses drink_statuses interests personality maxDistanceKm strictFilters createdBy updatedBy createdAt updatedAt';

// Used before any preference lookup so invalid ObjectIds never reach Mongo queries.
export const assertValidCandidateId = (candidateId: string) => {
  if (!Types.ObjectId.isValid(candidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }

  return candidateId;
};

// Loads the small candidate snapshot needed to create safe default preferences.
export const getCandidatePreferenceSeedOrThrow = async (candidateId: string) => {
  const candidate = await Candidate.findById(candidateId)
    .select('_id gender isActive user')
    .lean<TCandidatePreferenceSeed | null>();

  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  if (candidate.isActive !== ActiveStatus.ACTIVE) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Inactive candidate profiles cannot manage preferences'
    );
  }

  return candidate;
};

// Blocks VIEWER linked users from changing feed-affecting preferences.
export const ensureWritablePreferenceAccess = (access: TActiveLinkedUserLean) => {
  if (access.accessRole === CandidateLinkedUserAccessRole.VIEWER) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Viewer access cannot update candidate preferences'
    );
  }
};

// Prevents empty PATCH requests, including `{ strictFilters: {} }`.
export const hasEffectivePatchPayload = (
  payload: ICandidatePreferencePayload
) => {
  const keys = Object.keys(payload);

  if (keys.length === 0) {
    return false;
  }

  return keys.some((key) => {
    if (key !== 'strictFilters') {
      return true;
    }

    return Object.keys(payload.strictFilters ?? {}).length > 0;
  });
};

// Checks range updates against current DB values when PATCH sends only one side.
export const assertRangeCompatibility = (
  payload: ICandidatePreferencePayload,
  existing?: {
    ageMin?: number;
    ageMax?: number;
    heightMin?: number;
    heightMax?: number;
  } | null
) => {
  const ageMin =
    payload.ageMin === null ? undefined : payload.ageMin ?? existing?.ageMin;
  const ageMax =
    payload.ageMax === null ? undefined : payload.ageMax ?? existing?.ageMax;
  const heightMin =
    payload.heightMin === null
      ? undefined
      : payload.heightMin ?? existing?.heightMin;
  const heightMax =
    payload.heightMax === null
      ? undefined
      : payload.heightMax ?? existing?.heightMax;

  if (typeof ageMin === 'number' && typeof ageMax === 'number' && ageMin > ageMax) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Maximum age must be greater than or equal to minimum age'
    );
  }

  if (
    typeof heightMin === 'number' &&
    typeof heightMax === 'number' &&
    heightMin > heightMax
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Maximum height must be greater than or equal to minimum height'
    );
  }
};

// Reads cached preferences after authorization; cache failures fall back to DB.
export const readPreferenceCache = async (candidateId: string) => {
  if (!redisClient.isOpen) {
    return null;
  }

  try {
    const cachedPreference = await redisClient.get(
      getCandidatePreferenceCacheKey(candidateId)
    );

    return cachedPreference ? JSON.parse(cachedPreference) : null;
  } catch {
    return null;
  }
};

// Stores GET results without waiting on Redis so the API response stays fast.
export const writePreferenceCache = (candidateId: string, preference: unknown) => {
  if (!redisClient.isOpen) {
    return;
  }

  void redisClient
    .set(getCandidatePreferenceCacheKey(candidateId), JSON.stringify(preference), {
      EX: CANDIDATE_PREFERENCE_CACHE_TTL_SECONDS,
    })
    .catch(() => undefined);
};

// Clears stale preference cache after writes without failing a successful DB update.
export const clearPreferenceCache = async (candidateId: string) => {
  if (!redisClient.isOpen) {
    return;
  }

  try {
    await redisClient.del(getCandidatePreferenceCacheKey(candidateId));
  } catch {
    // Cache invalidation should never turn a successful write into an API error.
  }
};
