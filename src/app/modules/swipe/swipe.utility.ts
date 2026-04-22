import crypto from 'crypto';
import { Types } from 'mongoose';
import { buildCandidateLabels } from '../candidate/candidate.utility';
import { VerificationState } from '../candidate/candidate.interface';
import {
  ICandidatePreferencePayload,
  ICandidatePreferenceStrictFilters,
  TCandidatePreferenceLean,
} from '../candidate-preference/candidatePreference.interface';
import { buildStrictFilters } from '../candidate-preference/candidatePreference.utility';
import {
  ISwipeFeedCandidateLean,
  ISwipeFeedCard,
  ISwipeFeedCursor,
  ISwipeFeedScore,
} from './swipe.interface';

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

export const SWIPE_FEED_SESSION_TTL_SECONDS = 15 * 60;
export const MIN_FEED_POOL_SIZE = 80;
export const MAX_FEED_POOL_SIZE = 250;

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

const isValueIncluded = <T extends string>(values: T[] | undefined, value?: T) =>
  Boolean(value && values?.includes(value));

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

  if (isWithinRange(candidate.height, preference.heightMin, preference.heightMax)) {
    matchScore += 8;
    scoreReasons.push('Height matches your preference');
  }

  if (isValueIncluded(preference.highest_educations, candidate.highest_education)) {
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

  if (
    strictFilters.location &&
    preference.maxDistanceKm !== undefined
  ) {
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
  score: ISwipeFeedScore
): ISwipeFeedCard => ({
  _id: candidate._id,
  address: candidate.address,
  age: getAgeFromDateOfBirth(candidate.dateOfBirth),
  bio: candidate.bio,
  caste: candidate.caste,
  createdAt: candidate.createdAt,
  drink_status: candidate.drink_status,
  gender: candidate.gender,
  have_children: candidate.have_children,
  height: candidate.height,
  highest_education: candidate.highest_education,
  images: candidate.images ?? [],
  interests: candidate.interests ?? [],
  isSuperLike: false,
  labels: buildCandidateLabels(candidate),
  matchScore: score.matchScore,
  move_abroad: candidate.move_abroad,
  name: candidate.name,
  occupation: candidate.occupation,
  personality: candidate.personality ?? [],
  relationship_status: candidate.relationship_status,
  religion: candidate.religion,
  scoreReasons: score.scoreReasons,
  sect: candidate.sect,
  smoke_status: candidate.smoke_status,
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
