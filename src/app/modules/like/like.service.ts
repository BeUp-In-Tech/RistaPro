import { StatusCodes } from 'http-status-codes';
import AppError from '../../errorHelpers/AppError';
import Candidate from '../candidate/candidate.model';
import { getActiveLinkedUserAccessOrThrow } from '../candidate/linked-user/candidateLinkedUser.helper';
import { ILikeListQuery, ILikeListResponse } from './like.interface';
import { getLikes, getPlanWithSeeWhoLiked } from './like.helper';

// ------------------------------------API LAYER-------------------------------------

// 1. WHO LIKED ME
const getReceivedLikes = async (
  userId: string,
  query: ILikeListQuery
): Promise<ILikeListResponse> => {
  // Access check keeps private candidate like history limited to linked users.
  await getActiveLinkedUserAccessOrThrow({
    candidateId: query.candidateId,
    userId,
  });

  // Plan check keeps "who liked me" behind gold/platinum capabilities.
  const candidatePlan = await Candidate.findById(query.candidateId)
    .select('plan')
    .lean<{ plan?: string } | null>();
  const plan = await getPlanWithSeeWhoLiked(candidatePlan?.plan);
  if (!plan.canSeeWhoLiked) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Need gold/premium access to unlock.'
    );
  }

  // Incoming likes are positive swipe actions where this candidate was liked.
  return getLikes({
    candidateField: 'likedProfile',
    query,
    targetField: 'likedBy',
  });
};

// 2. WHOM I LIKED
const getSentLikes = async (
  userId: string,
  query: ILikeListQuery
): Promise<ILikeListResponse> => {
  // Access check keeps a candidate's outgoing like history private.
  await getActiveLinkedUserAccessOrThrow({
    candidateId: query.candidateId,
    userId,
  });

  // Outgoing likes are positive swipe actions made by this candidate.
  return getLikes({
    candidateField: 'likedBy',
    query,
    targetField: 'likedProfile',
  });
};

export const LikeService = {
  getReceivedLikes,
  getSentLikes,
};
