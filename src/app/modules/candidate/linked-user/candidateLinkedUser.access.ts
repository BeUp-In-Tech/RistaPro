import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../../errorHelpers/AppError';
import { ActiveStatus } from '../../user/user.interface';
import Candidate from '../candidate.model';
import CandidateLinkedUser from './candidateLinkedUser.model';
import { CandidateLinkedUserStatus } from './candidateLinkedUser.interface';

type TUserCandidateAccessSource = 'LINKED_USER' | 'LEGACY_OWNER';

export interface TUserActiveCandidateAccess {
  candidateId: string;
  source: TUserCandidateAccessSource;
}

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

export const ensureNoOtherActiveCandidateAccess = async (params: {
  userId: string;
  excludeCandidateId?: string;
  message?: string;
}) => {
  const { excludeCandidateId, message, userId } = params;
  const accesses = await getActiveCandidateAccessesForUser(userId);
  const conflictingAccess = accesses.find(
    (access) => access.candidateId !== excludeCandidateId
  );

  if (conflictingAccess) {
    throw new AppError(
      StatusCodes.CONFLICT,
      message ?? 'This account is already linked to another active candidate profile'
    );
  }

  return conflictingAccess ?? null;
};

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
