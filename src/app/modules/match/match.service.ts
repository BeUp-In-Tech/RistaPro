import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errorHelpers/AppError';
import Match from './match.model';
import { MatchStatus, TPopulatedMatchLean } from './match.interface';
import {
  archiveOpenMatchConversation,
  assertCanListCandidateMatches,
  assertValidObjectId,
  buildMatchResponse,
  getMatchAccessOrThrow,
  getMatchByIdOrThrow,
  getPopulatedMatchByIdOrThrow,
  MATCH_CANDIDATE_SELECT,
  MATCH_SELECT,
} from './match.helper';

// GET /matches - Lists active matches for the candidate profile the user can access.
const getMatches = async (userId: string, candidateIdParam: string) => {
  const candidateId = assertValidObjectId(candidateIdParam, 'candidate id');

  // Listing is candidate-scoped, so the regular linked-user access check is enough.
  await assertCanListCandidateMatches({
    candidateId,
    userId,
  });

  const matches = await Match.find({
    candidates: new Types.ObjectId(candidateId),
    status: MatchStatus.ACTIVE,
  })
    .select(MATCH_SELECT)
    .sort({ updatedAt: -1, createdAt: -1 })
    .populate({
      path: 'candidates',
      select: MATCH_CANDIDATE_SELECT,
    })
    .lean<TPopulatedMatchLean[]>();

  return matches.map(buildMatchResponse);
};

// GET /matches/:matchId - Returns one match after confirming the user belongs to either side.
const getMatch = async (
  userId: string,
  matchId: string,
  candidateId?: string
) => {
  const match = await getMatchByIdOrThrow(matchId);

  // candidateId is optional; when present, it must be one of the two matched candidates.
  await getMatchAccessOrThrow({ candidateId, match, userId });

  const populatedMatch = await getPopulatedMatchByIdOrThrow(matchId);
  return buildMatchResponse(populatedMatch);
};

// PATCH /matches/:matchId/unmatch - Closes the match and archives its open conversation.
const unmatch = async (
  userId: string,
  matchId: string,
  candidateId?: string
) => {
  const match = await getMatchByIdOrThrow(matchId);

  // Only OWNER/EDITOR linked users can mutate match state.
  await getMatchAccessOrThrow({
    candidateId,
    match,
    requireWritable: true,
    userId,
  });

  if (match.status !== MatchStatus.ACTIVE) {
    throw new AppError(StatusCodes.CONFLICT, 'Match is not active');
  }

  const updatedMatch = await Match.findByIdAndUpdate(
    match._id,
    { $set: { status: MatchStatus.UNMATCHED } },
    { new: true }
  )
    .select(MATCH_SELECT)
    .populate({
      path: 'candidates',
      select: MATCH_CANDIDATE_SELECT,
    })
    .lean<TPopulatedMatchLean | null>();

  if (!updatedMatch) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Match not found');
  }

  await archiveOpenMatchConversation(match);

  return buildMatchResponse(updatedMatch);
};

export const MatchService = {
  getMatch,
  getMatches,
  unmatch,
};
