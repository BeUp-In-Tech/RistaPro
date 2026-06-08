import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errorHelpers/AppError';
import Conversation from '../conversation/conversation.model';
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
const getMatches = async (
  userId: string,
  candidateIdParam: string,
  hasStartedChat?: boolean,
) => {
  const candidateId = assertValidObjectId(candidateIdParam, 'candidate id');

  // Listing is candidate-scoped, so the regular linked-user access check is enough.
  await assertCanListCandidateMatches({
    candidateId,
    userId,
  });

  const matchFilter: Record<string, unknown> = {
    candidates: new Types.ObjectId(candidateId),
    status: MatchStatus.ACTIVE,
  };

  // When hasStartedChat filter is provided, narrow by whether the linked
  // conversation already has a lastMessage or not.
  if (hasStartedChat === true) {
    // conversation must exist and have a lastMessage set
    matchFilter.conversation = { $exists: true };
    const conversationIds = await Conversation.find({
      participants: new Types.ObjectId(candidateId),
      lastMessage: { $exists: true, $ne: null },
    })
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>();

    matchFilter.conversation = {
      $in: conversationIds.map((c) => c._id),
    };
  } else if (hasStartedChat === false) {
    // conversation either doesn't exist or has no lastMessage
    const conversationIds = await Conversation.find({
      participants: new Types.ObjectId(candidateId),
      lastMessage: { $exists: true, $ne: null },
    })
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>();

    matchFilter.$or = [
      { conversation: { $exists: false } },
      { conversation: null },
      {
        conversation: {
          $nin: conversationIds.map((c) => c._id),
        },
      },
    ];
  }

  const matches = await Match.find(matchFilter)
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

// PATCH /matches/:matchId/unmatched - Closes the match and archives its open conversation.
const unmatched = async (
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
  unmatched,
};
