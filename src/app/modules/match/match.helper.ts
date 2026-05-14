import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errorHelpers/AppError';
import CandidateLinkedUser from '../candidate/linked-user/candidateLinkedUser.model';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserStatus,
  TActiveLinkedUserLean,
} from '../candidate/linked-user/candidateLinkedUser.interface';
import {
  getActiveLinkedUserAccessOrThrow,
  syncLegacyOwnerLinks,
} from '../candidate/linked-user/candidateLinkedUser.helper';
import Conversation from '../conversation/conversation.model';
import {
  ConversationSource,
  ConversationStatus,
  TConversationIdLean,
} from '../conversation/conversation.interface';
import Match from './match.model';
import {
  TMatchCandidateLean,
  TMatchWithCandidateIds,
  TPopulatedMatchLean,
} from './match.interface';

export const MATCH_SELECT =
  '_id candidates conversation matchedBy pairKey status createdAt updatedAt';

export const MATCH_CANDIDATE_SELECT =
  '_id name dateOfBirth gender images religion address';

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

// Rejects malformed ObjectIds before they reach Mongo queries.
export const assertValidObjectId = (id: string, fieldLabel: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(StatusCodes.BAD_REQUEST, `Invalid ${fieldLabel}`);
  }

  return id;
};

// Builds the canonical pair key so candidate A/B and B/A share one match.
export const buildMatchPairKey = (
  firstCandidateId: string,
  secondCandidateId: string
) => [firstCandidateId, secondCandidateId].sort().join('_');

// Converts DOB to a whole-year age for lightweight match cards.
const getAgeFromDateOfBirth = (dateOfBirth: Date, now = new Date()) =>
  Math.floor((now.getTime() - dateOfBirth.getTime()) / MS_PER_YEAR);

// Extracts the two candidate ids and protects match operations from corrupt rows.
export const getMatchCandidateIds = (match: TMatchWithCandidateIds) => {
  if (match.candidates.length !== 2) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Match must contain exactly two candidates'
    );
  }

  return match.candidates.map((candidateId) => candidateId.toString());
};

// Ensures the optional candidateId query actually belongs to the match.
export const assertCandidateBelongsToMatch = (
  match: TMatchWithCandidateIds,
  candidateId: string
) => {
  const candidateExistsInMatch = match.candidates.some(
    (matchCandidateId) => matchCandidateId.toString() === candidateId
  );

  if (!candidateExistsInMatch) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'This candidate does not belong to the match'
    );
  }
};

// Loads the minimal match record used for authorization and state changes.
export const getMatchByIdOrThrow = async (matchId: string) => {
  assertValidObjectId(matchId, 'match id');

  const match = await Match.findById(matchId)
    .select(MATCH_SELECT)
    .lean<TMatchWithCandidateIds | null>();

  if (!match) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Match not found');
  }

  return match;
};

// Loads the frontend-facing match record with candidate card summaries populated.
export const getPopulatedMatchByIdOrThrow = async (matchId: string) => {
  assertValidObjectId(matchId, 'match id');

  const match = await Match.findById(matchId)
    .select(MATCH_SELECT)
    .populate({
      path: 'candidates',
      select: MATCH_CANDIDATE_SELECT,
    })
    .lean<TPopulatedMatchLean | null>();

  if (!match) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Match not found');
  }

  return match;
};

// Confirms the logged-in user can access the match through one matched candidate.
export const getMatchAccessOrThrow = async (params: {
  candidateId?: string;
  match: TMatchWithCandidateIds;
  requireWritable?: boolean;
  userId: string;
}) => {
  const { candidateId, match, requireWritable = false, userId } = params;

  if (candidateId) {
    assertValidObjectId(candidateId, 'candidate id');
    assertCandidateBelongsToMatch(match, candidateId);

    const { access } = await getActiveLinkedUserAccessOrThrow({
      candidateId,
      userId,
    });

    if (
      requireWritable &&
      access.accessRole === CandidateLinkedUserAccessRole.VIEWER
    ) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        'Viewer access cannot unmatched candidates'
      );
    }

    return access;
  }

  const matchCandidateIds = getMatchCandidateIds(match);
  await syncLegacyOwnerLinks({ candidateIds: matchCandidateIds, userId });

  const access = await CandidateLinkedUser.findOne({
    candidate: { $in: matchCandidateIds },
    status: CandidateLinkedUserStatus.ACTIVE,
    user: userId,
  })
    .select(
      '_id candidate user relationshipToCandidate accessRole status isPrimary linkedBy joinedAt removedAt createdAt updatedAt'
    )
    .lean<TActiveLinkedUserLean | null>();

  if (!access) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You do not have access to this match'
    );
  }

  if (
    requireWritable &&
    access.accessRole === CandidateLinkedUserAccessRole.VIEWER
  ) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Viewer access cannot unmatched candidates'
    );
  }

  return access;
};

// Confirms the user can list matches for a specific candidate profile.
export const assertCanListCandidateMatches = async (params: {
  candidateId: string;
  userId: string;
}) => {
  await getActiveLinkedUserAccessOrThrow(params);
};

// Converts a candidate document into the compact shape returned by match APIs.
export const buildMatchCandidateSummary = (candidate: TMatchCandidateLean) => ({
  _id: candidate._id,
  age: getAgeFromDateOfBirth(candidate.dateOfBirth),
  gender: candidate.gender,
  images: candidate.images ?? [],
  livesIn: candidate.address?.split(',')[0]?.trim() || undefined,
  name: candidate.name,
  religion: candidate.religion,
});

// Keeps all match endpoints returning the same predictable response shape.
export const buildMatchResponse = (match: TPopulatedMatchLean) => ({
  _id: match._id,
  candidates: match.candidates.map(buildMatchCandidateSummary),
  conversation: match.conversation,
  matchedBy: match.matchedBy,
  pairKey: match.pairKey,
  status: match.status,
  createdAt: match.createdAt,
  updatedAt: match.updatedAt,
});

// Creates or returns the single conversation that belongs to a matched pair.
export const ensureMatchConversation = async (
  match: TMatchWithCandidateIds
) => {
  const candidateIds = getMatchCandidateIds(match);
  const pairKey =
    match.pairKey || buildMatchPairKey(candidateIds[0], candidateIds[1]);
  const participants = candidateIds.map(
    (candidateId) => new Types.ObjectId(candidateId)
  );

  let conversation: TConversationIdLean | null = null;

  try {
    conversation = await Conversation.findOneAndUpdate(
      { pairKey },
      {
        $set: { match: match._id },
        $setOnInsert: {
          pairKey,
          parentInvolvement: false,
          participants,
          source: ConversationSource.MATCH,
          status: ConversationStatus.OPEN,
        },
      },
      {
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
        upsert: true,
      }
    )
      .select('_id')
      .lean<TConversationIdLean | null>();
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) {
      throw error;
    }

    conversation = await Conversation.findOne({
      $or: [{ pairKey }, { match: match._id }],
    })
      .select('_id')
      .lean<TConversationIdLean | null>();
  }

  if (!conversation) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to create match conversation'
    );
  }

  if (match.conversation?.toString() !== conversation._id.toString()) {
    await Match.updateOne(
      { _id: match._id },
      { $set: { conversation: conversation._id } }
    );
  }

  return {
    ...match,
    conversation: conversation._id,
  };
};

// Archives the open conversation when a user explicitly unmatched.
export const archiveOpenMatchConversation = async (
  match: TMatchWithCandidateIds
) => {
  const conversationFilters: Record<string, unknown>[] = [
    { pairKey: match.pairKey },
  ];

  if (match.conversation) {
    conversationFilters.push({ _id: match.conversation });
  }

  await Conversation.updateMany(
    {
      $or: conversationFilters,
      status: ConversationStatus.OPEN,
    },
    { $set: { status: ConversationStatus.ARCHIVED } }
  );
};
