import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errorHelpers/AppError';
import { Gender } from '../candidate/candidate.interface';
import { getActiveLinkedUserAccessOrThrow } from '../candidate/linked-user/candidateLinkedUser.helper';
import CandidatePreference from './candidatePreference.model';
import { ICandidatePreferencePayload } from './candidatePreference.interface';
import {
  buildDefaultPreferencePayload,
  buildPreferencePatchOperation,
  buildPreferenceReplaceOperation,
} from './candidatePreference.utility';
import {
  assertRangeCompatibility,
  assertValidCandidateId,
  clearPreferenceCache,
  ensureWritablePreferenceAccess,
  getCandidatePreferenceSeedOrThrow,
  hasEffectivePatchPayload,
  PREFERENCE_RESPONSE_SELECT,
  readPreferenceCache,
  writePreferenceCache,
} from './candidatePreference.helper';

export const ensureDefaultCandidatePreference = async (params: {
  candidateGender?: Gender;
  candidateId: string | Types.ObjectId;
  createdBy?: string | Types.ObjectId;
}) => {
  const candidateId = assertValidCandidateId(params.candidateId.toString());
  let candidateGender = params.candidateGender;
  let createdBy = params.createdBy;

  if (!candidateGender || !createdBy) {
    const seed = await getCandidatePreferenceSeedOrThrow(candidateId);
    candidateGender = candidateGender ?? seed.gender;
    createdBy = createdBy ?? seed.user;
  }

  const preference = await CandidatePreference.findOneAndUpdate(
    { candidate: candidateId },
    {
      $setOnInsert: buildDefaultPreferencePayload({
        candidateGender,
        candidateId,
        createdBy,
      }),
    },
    {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  )
    .select(PREFERENCE_RESPONSE_SELECT)
    .lean();

  if (!preference) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to create candidate preferences'
    );
  }

  return preference;
};

export const deleteCandidatePreferenceByCandidateId = async (
  candidateId: string | Types.ObjectId
) => {
  await CandidatePreference.deleteOne({ candidate: candidateId });
  await clearPreferenceCache(candidateId.toString());
};

// 1. AUTH LINKED USER GET CANDIDATE PREFERENCE
const getCandidatePreference = async (userId: string, candidateIdParam: string) => {
  const candidateId = assertValidCandidateId(candidateIdParam);

  // Always authorize before reading cache so private preferences are never leaked.
  await getActiveLinkedUserAccessOrThrow({ candidateId, userId });

  const cachedPreference = await readPreferenceCache(candidateId);
  if (cachedPreference) {
    return cachedPreference;
  }

  const existingPreference = await CandidatePreference.findOne({
    candidate: candidateId,
  })
    .select(PREFERENCE_RESPONSE_SELECT)
    .lean();

  const preference =
    existingPreference ??
    (await ensureDefaultCandidatePreference({ candidateId }));

  writePreferenceCache(candidateId, preference);

  return preference;
};

// 2. AUTH EDITOR/OWNER REPLACE CANDIDATE PREFERENCE
const replaceCandidatePreference = async (
  userId: string,
  candidateIdParam: string,
  payload: ICandidatePreferencePayload
) => {
  const candidateId = assertValidCandidateId(candidateIdParam);
  const [{ access }, seed] = await Promise.all([
    getActiveLinkedUserAccessOrThrow({ candidateId, userId }),
    getCandidatePreferenceSeedOrThrow(candidateId),
  ]);

  ensureWritablePreferenceAccess(access);
  assertRangeCompatibility(payload);

  const updatedPreference = await CandidatePreference.findOneAndUpdate(
    { candidate: candidateId },
    buildPreferenceReplaceOperation({
      candidateGender: seed.gender,
      candidateId,
      payload,
      userId,
    }),
    {
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  )
    .select(PREFERENCE_RESPONSE_SELECT)
    .lean();

  if (!updatedPreference) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to update candidate preferences'
    );
  }

  await clearPreferenceCache(candidateId);

  return updatedPreference;
};

// 3. AUTH EDITOR/OWNER PARTIAL UPDATE CANDIDATE PREFERENCE
const updateCandidatePreference = async (
  userId: string,
  candidateIdParam: string,
  payload: ICandidatePreferencePayload
) => {
  if (!hasEffectivePatchPayload(payload)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'At least one preference field is required to update'
    );
  }

  const candidateId = assertValidCandidateId(candidateIdParam);
  const [{ access }, seed] = await Promise.all([
    getActiveLinkedUserAccessOrThrow({ candidateId, userId }),
    getCandidatePreferenceSeedOrThrow(candidateId),
  ]);

  ensureWritablePreferenceAccess(access);

  // Ensure older candidate profiles get a default preference before patching.
  await ensureDefaultCandidatePreference({
    candidateGender: seed.gender,
    candidateId,
    createdBy: seed.user,
  });

  const existingPreference = await CandidatePreference.findOne({
    candidate: candidateId,
  })
    .select('ageMin ageMax heightMin heightMax')
    .lean<{
      ageMin?: number;
      ageMax?: number;
      heightMin?: number;
      heightMax?: number;
    } | null>();

  assertRangeCompatibility(payload, existingPreference);

  const updatedPreference = await CandidatePreference.findOneAndUpdate(
    { candidate: candidateId },
    buildPreferencePatchOperation({
      candidateGender: seed.gender,
      payload,
      userId,
    }),
    {
      new: true,
      runValidators: true,
    }
  )
    .select(PREFERENCE_RESPONSE_SELECT)
    .lean();

  if (!updatedPreference) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Candidate preferences not found'
    );
  }

  await clearPreferenceCache(candidateId);

  return updatedPreference;
};

export const CandidatePreferenceService = {
  getCandidatePreference,
  replaceCandidatePreference,
  updateCandidatePreference,
};
