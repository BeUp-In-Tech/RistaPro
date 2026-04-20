import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../../errorHelpers/AppError';
import { ActiveStatus } from '../../user/user.interface';
import Candidate from '../candidate.model';
import CandidateLinkedUser from './candidateLinkedUser.model';
import { CandidateLinkedUserStatus } from './candidateLinkedUser.interface';
import { deleteImageByBullMQ } from '../../../utils/backgroundJobProcessingHelper';

type TUserCandidateAccessSource = 'LINKED_USER' | 'LEGACY_OWNER';

export interface TUserActiveCandidateAccess {
  candidateId: string;
  source: TUserCandidateAccessSource;
}

/**
 * Collects every active candidate profile a user can currently access.
 *
 * Access can come from the newer linked-user table or from the older direct
 * candidate ownership field. Results are de-duplicated by candidate id, with
 * linked-user access taking priority when both sources point to the same
 * candidate.
 */
export const getActiveCandidateAccessesForUser = async (
  userId: string
): Promise<TUserActiveCandidateAccess[]> => {
  const [activeLinkedUsers, legacyOwnedCandidates] = await Promise.all([
    CandidateLinkedUser.find({
      status: CandidateLinkedUserStatus.ACTIVE,
      user: userId,
    })
      .select('candidate')
      .lean<{ candidate: Types.ObjectId }[]>(),
    Candidate.find({
      isActive: ActiveStatus.ACTIVE,
      user: userId,
    })
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>(),
  ]);

  const accessMap = new Map<string, TUserActiveCandidateAccess>();

  for (const linkedUser of activeLinkedUsers) {
    const candidateId = linkedUser.candidate.toString();

    accessMap.set(candidateId, {
      candidateId,
      source: 'LINKED_USER',
    });
  }

  for (const candidate of legacyOwnedCandidates) {
    const candidateId = candidate._id.toString();

    if (!accessMap.has(candidateId)) {
      accessMap.set(candidateId, {
        candidateId,
        source: 'LEGACY_OWNER',
      });
    }
  }

  return Array.from(accessMap.values());
};

/**
 * Blocks a user from being attached to any other active candidate profile.
 *
 * Pass `excludeCandidateId` when updating the user's relationship to a profile
 * they already belong to. Any active access outside that excluded profile is
 * treated as a conflict.
 */
export const ensureNoOtherActiveCandidateAccess = async (params: {
  userId: string;
  excludeCandidateId?: string;
  message?: string;
  images?: string[];
}) => {
  const { excludeCandidateId, message, userId, images } = params;
  const accesses = await getActiveCandidateAccessesForUser(userId);
  const conflictingAccess = accesses.find(
    (access) => access.candidateId !== excludeCandidateId
  );

  if (conflictingAccess) {

  // DELETE EXISTING IMAGE
  await deleteImageByBullMQ(images ?? [], `delete_image_${Date.now()}_${userId}`);

  // THROW ERROR
    throw new AppError(
      StatusCodes.CONFLICT,
      message ?? 'This account is already linked to another active candidate profile'
    );
  }

  return conflictingAccess ?? null;
};

/**
 * Ensures the user is not linked to multiple active candidate profiles.
 *
 * This is used before flows that can only work when an account has zero or one
 * active candidate context. It returns the current access list so callers can
 * continue without querying again.
 */
export const ensureSingleActiveCandidateAccessOrThrow = async (params: {
  userId: string;
  message?: string;
}) => {
  const { message, userId } = params;
  const accesses = await getActiveCandidateAccessesForUser(userId);

  if (accesses.length > 1) {
    throw new AppError(
      StatusCodes.CONFLICT,
      message ??
        'This account is linked to multiple active candidate profiles. Please resolve the duplicate assignments first'
    );
  }

  return accesses;
};
