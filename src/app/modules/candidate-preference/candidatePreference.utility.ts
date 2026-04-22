import { Types } from 'mongoose';
import { Gender } from '../candidate/candidate.interface';
import {
  ICandidatePreferencePayload,
  ICandidatePreferenceStrictFilters,
} from './candidatePreference.interface';

const optionalNumberFields = [
  'ageMin',
  'ageMax',
  'heightMin',
  'heightMax',
  'maxDistanceKm',
] as const;

const arrayPreferenceFields = [
  'religions',
  'sects',
  'castes',
  'relationship_statuses',
  'have_children',
  'move_abroad',
  'occupations',
  'highest_educations',
  'smoke_statuses',
  'drink_statuses',
  'interests',
  'personality',
] as const;

const strictFilterFields = [
  'gender',
  'age',
  'height',
  'religion',
  'caste',
  'location',
] as const;

export const CANDIDATE_PREFERENCE_CACHE_TTL_SECONDS = 5 * 60;

// Builds the Redis key used when one candidate repeatedly opens the preference form.
export const getCandidatePreferenceCacheKey = (candidateId: string) =>
  `candidate_preference:${candidateId}`;

// Chooses the first sensible gender preference when a candidate profile is created.
export const getDefaultPreferredGenders = (gender: Gender) => {
  if (gender === Gender.MALE) {
    return [Gender.FEMALE];
  }

  if (gender === Gender.FEMALE) {
    return [Gender.MALE];
  }

  return [Gender.MALE, Gender.FEMALE, Gender.OTHER];
};

// Normalizes preference arrays so scoring does not double-count duplicate choices.
const getUniqueValues = <T extends string>(values?: T[]) =>
  values ? Array.from(new Set(values)) : undefined;

// Builds hard-vs-soft filter flags for feed matching, with age becoming strict only when bounded.
export const buildStrictFilters = (
  payload: ICandidatePreferencePayload = {}
): ICandidatePreferenceStrictFilters => ({
  gender: true,
  // Age becomes strict automatically only when an age boundary exists.
  age: payload.ageMin !== undefined || payload.ageMax !== undefined,
  height: false,
  religion: false,
  caste: false,
  location: false,
  ...(payload.strictFilters ?? {}),
});

// Creates the initial preference document right after candidate profile creation.
export const buildDefaultPreferencePayload = (params: {
  candidateId: string | Types.ObjectId;
  candidateGender: Gender;
  createdBy: string | Types.ObjectId;
}) => {
  const { candidateGender, candidateId, createdBy } = params;

  return {
    candidate: candidateId,
    createdBy,
    preferredGenders: getDefaultPreferredGenders(candidateGender),
    strictFilters: buildStrictFilters(),
  };
};

// Builds a full replace operation where missing optional fields are intentionally cleared.
export const buildPreferenceReplaceOperation = (params: {
  candidateGender: Gender;
  candidateId: string | Types.ObjectId;
  payload: ICandidatePreferencePayload;
  userId: string | Types.ObjectId;
}) => {
  const { candidateGender, candidateId, payload, userId } = params;
  const $set: Record<string, unknown> = {
    candidate: candidateId,
    preferredGenders:
      getUniqueValues(payload.preferredGenders) ??
      getDefaultPreferredGenders(candidateGender),
    strictFilters: buildStrictFilters(payload),
    updatedBy: userId,
  };
  const $unset: Record<string, ''> = {};

  for (const field of arrayPreferenceFields) {
    $set[field] = getUniqueValues(payload[field]) ?? [];
  }

  for (const field of optionalNumberFields) {
    const value = payload[field];

    if (value === undefined || value === null) {
      $unset[field] = '';
    } else {
      $set[field] = value;
    }
  }

  return {
    $set,
    $setOnInsert: { createdBy: userId },
    ...(Object.keys($unset).length ? { $unset } : {}),
  };
};

// Builds a partial update operation where only sent fields are touched.
export const buildPreferencePatchOperation = (params: {
  payload: ICandidatePreferencePayload;
  userId: string | Types.ObjectId;
}) => {
  const { payload, userId } = params;
  const $set: Record<string, unknown> = { updatedBy: userId };
  const $unset: Record<string, ''> = {};

  if (payload.preferredGenders !== undefined) {
    $set.preferredGenders = getUniqueValues(payload.preferredGenders);
  }

  for (const field of arrayPreferenceFields) {
    if (payload[field] !== undefined) {
      $set[field] = getUniqueValues(payload[field]) ?? [];
    }
  }

  for (const field of optionalNumberFields) {
    const value = payload[field];

    if (value === null) {
      $unset[field] = '';
    } else if (value !== undefined) {
      $set[field] = value;
    }
  }

  if (payload.strictFilters) {
    for (const field of strictFilterFields) {
      if (payload.strictFilters[field] !== undefined) {
        $set[`strictFilters.${field}`] = payload.strictFilters[field];
      }
    }
  }

  return {
    $set,
    ...(Object.keys($unset).length ? { $unset } : {}),
  };
};
