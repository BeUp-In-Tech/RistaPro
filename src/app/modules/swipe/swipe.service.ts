import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../errorHelpers/AppError';
import Candidate from '../candidate/candidate.model';
import { getActiveLinkedUserAccessOrThrow } from '../candidate/linked-user/candidateLinkedUser.helper';
import Like from '../like/like.model';
import Match from '../match/match.model';
import Report from '../report/report.model';
import {
  ISwipeFeedCandidateLean,
  ISwipeFeedQuery,
  ISwipeFeedResponse,
  ISwipeFeedSession,
} from './swipe.interface';
import {
  assertValidFeedCandidateId,
  buildCandidateFeedQuery,
  FEED_CANDIDATE_SELECT,
  findVisibleFeedCandidates,
  getFeedPreferenceOrCreateDefault,
  readSwipeFeedSession,
  writeSwipeFeedSession,
} from './swipe.helper';
import {
  buildFeedCard,
  createFeedSessionId,
  decodeFeedCursor,
  encodeFeedCursor,
  getEffectiveStrictFilters,
  getFeedPoolSize,
  passesPostQueryStrictFilters,
  scoreFeedCandidate,
  sortCandidatesByIdOrder,
  toObjectIdList,
} from './swipe.utility';



// -------------------------------HELPER------------------------------------------------
const RELAXED_FEED_REASON = 'Not enough candidates matched all strict preferences';

// Builds the exclusion set so the same profile does not reappear after like/pass/match/report.
const getExcludedCandidateIds = async (candidateId: string) => {
  const [existingActions, existingMatches, existingReports] = await Promise.all([
    Like.find({ likedBy: candidateId })
      .select('likedProfile')
      .lean<{ likedProfile: Types.ObjectId }[]>(),
    Match.find({ candidates: candidateId })
      .select('candidates')
      .lean<{ candidates: Types.ObjectId[] }[]>(),
    Report.find({
      $or: [{ reportedBy: candidateId }, { reportedCandidate: candidateId }],
    })
      .select('reportedBy reportedCandidate')
      .lean<{
        reportedBy: Types.ObjectId;
        reportedCandidate: Types.ObjectId;
      }[]>(),
  ]);

  const excludedIds = new Set<string>([candidateId]);

  for (const action of existingActions) {
    excludedIds.add(action.likedProfile.toString());
  }

  for (const match of existingMatches) {
    for (const matchedCandidateId of match.candidates) {
      excludedIds.add(matchedCandidateId.toString());
    }
  }

  for (const report of existingReports) {
    excludedIds.add(report.reportedBy.toString());
    excludedIds.add(report.reportedCandidate.toString());
  }

  return toObjectIdList(Array.from(excludedIds));
};

const getViewerCandidateOrThrow = async (candidateId: string) => {
  const candidate = await Candidate.findById(candidateId)
    .select(FEED_CANDIDATE_SELECT)
    .lean<ISwipeFeedCandidateLean | null>();

  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  return candidate;
};

const filterStrictCandidates = (params: {
  candidates: ISwipeFeedCandidateLean[];
  preference: Awaited<ReturnType<typeof getFeedPreferenceOrCreateDefault>>;
  viewerCandidate: ISwipeFeedCandidateLean;
}) => {
  const strictFilters = getEffectiveStrictFilters(params.preference);

  return params.candidates.filter((candidate) =>
    passesPostQueryStrictFilters({
      candidate,
      preference: params.preference,
      strictFilters,
      viewerCandidate: params.viewerCandidate,
    })
  );
};

const rankCandidates = (params: {
  candidates: ISwipeFeedCandidateLean[];
  preference: Awaited<ReturnType<typeof getFeedPreferenceOrCreateDefault>>;
  viewerCandidate: ISwipeFeedCandidateLean;
}) => {
  const { candidates, preference, viewerCandidate } = params;

  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreFeedCandidate({ candidate, preference, viewerCandidate }),
    }))
    .sort((firstCandidate, secondCandidate) => {
      if (secondCandidate.score.matchScore !== firstCandidate.score.matchScore) {
        return secondCandidate.score.matchScore - firstCandidate.score.matchScore;
      }

      const secondImageCount = secondCandidate.candidate.images?.length ?? 0;
      const firstImageCount = firstCandidate.candidate.images?.length ?? 0;

      if (secondImageCount !== firstImageCount) {
        return secondImageCount - firstImageCount;
      }

      return (
        new Date(secondCandidate.candidate.createdAt ?? 0).getTime() -
        new Date(firstCandidate.candidate.createdAt ?? 0).getTime()
      );
    });
};

const buildFeedResponseFromRankedCandidates = (params: {
  candidateId: string;
  limit: number;
  rankedCandidates: ReturnType<typeof rankCandidates>;
  relaxed: boolean;
  relaxedReason?: string;
}): ISwipeFeedResponse => {
  const { candidateId, limit, rankedCandidates, relaxed, relaxedReason } =
    params;
  const sessionId = createFeedSessionId();
  const candidateIds = rankedCandidates.map(({ candidate }) =>
    candidate._id.toString()
  );
  const session: ISwipeFeedSession = {
    candidateIds,
    createdAt: new Date().toISOString(),
    relaxed,
    relaxedReason,
  };
  const sessionStored =
    candidateIds.length > limit &&
    writeSwipeFeedSession({ candidateId, session, sessionId });
  const nextCursor = sessionStored
    ? encodeFeedCursor({ offset: limit, sessionId })
    : null;

  return {
    cards: rankedCandidates
      .slice(0, limit)
      .map(({ candidate, score }) => buildFeedCard(candidate, score)),
    limit,
    nextCursor,
    relaxed,
    ...(relaxedReason ? { relaxedReason } : {}),
  };
};

const getFeedFromCachedSession = async (params: {
  candidateId: string;
  cursor: string;
  limit: number;
  viewerCandidate: ISwipeFeedCandidateLean;
}) => {
  const decodedCursor = decodeFeedCursor(params.cursor);

  if (!decodedCursor) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid feed cursor');
  }

  const session = await readSwipeFeedSession({
    candidateId: params.candidateId,
    sessionId: decodedCursor.sessionId,
  });

  if (!session) {
    return null;
  }

  const sliceIds = session.candidateIds.slice(
    decodedCursor.offset,
    decodedCursor.offset + params.limit
  );

  if (!sliceIds.length) {
    return {
      cards: [],
      limit: params.limit,
      nextCursor: null,
      relaxed: session.relaxed,
      ...(session.relaxedReason ? { relaxedReason: session.relaxedReason } : {}),
    };
  }

  const [preference, candidates] = await Promise.all([
    getFeedPreferenceOrCreateDefault({
      candidateGender: params.viewerCandidate.gender,
      candidateId: params.candidateId,
      createdBy: params.viewerCandidate.user as Types.ObjectId,
    }),
    findVisibleFeedCandidates({
      limit: sliceIds.length,
      query: { _id: { $in: toObjectIdList(sliceIds) } },
    }),
  ]);

  const sortedCandidates = sortCandidatesByIdOrder(candidates, sliceIds);
  const rankedCandidates = sortedCandidates.map((candidate) => ({
    candidate,
    score: scoreFeedCandidate({
      candidate,
      preference,
      viewerCandidate: params.viewerCandidate,
    }),
  }));

  const nextOffset = decodedCursor.offset + params.limit;
  const nextCursor =
    nextOffset < session.candidateIds.length
      ? encodeFeedCursor({
          offset: nextOffset,
          sessionId: decodedCursor.sessionId,
        })
      : null;

  return {
    cards: rankedCandidates.map(({ candidate, score }) =>
      buildFeedCard(candidate, score)
    ),
    limit: params.limit,
    nextCursor,
    relaxed: session.relaxed,
    ...(session.relaxedReason ? { relaxedReason: session.relaxedReason } : {}),
  };
};


// ------------------------------------API----------------------------------------
// 1. GET FEED: returns the ranked candidate stack for Tinder-style discovery.
const getSwipeFeed = async (
  userId: string,
  query: ISwipeFeedQuery
): Promise<ISwipeFeedResponse> => {
  assertValidFeedCandidateId(query.candidateId);

  // Linked access allows OWNER/EDITOR/VIEWER to view feed, while mutations are handled later.
  await getActiveLinkedUserAccessOrThrow({
    candidateId: query.candidateId,
    userId,
  });

  const viewerCandidate = await getViewerCandidateOrThrow(query.candidateId);

  if (query.cursor) {
    const cachedResponse = await getFeedFromCachedSession({
      candidateId: query.candidateId,
      cursor: query.cursor,
      limit: query.limit,
      viewerCandidate,
    });

    if (cachedResponse) {
      return cachedResponse;
    }
  }

  const [preference, excludedCandidateIds] = await Promise.all([
    getFeedPreferenceOrCreateDefault({
      candidateGender: viewerCandidate.gender,
      candidateId: query.candidateId,
      createdBy: viewerCandidate.user as Types.ObjectId,
    }),
    getExcludedCandidateIds(query.candidateId),
  ]);
  const poolSize = getFeedPoolSize(query.limit);
  const strictQuery = buildCandidateFeedQuery({
    candidateId: query.candidateId,
    excludedCandidateIds,
    preference,
  });
  const strictCandidates = filterStrictCandidates({
    candidates: await findVisibleFeedCandidates({
      limit: poolSize,
      query: strictQuery,
    }),
    preference,
    viewerCandidate,
  });

  let relaxed = false;
  let relaxedReason: string | undefined;
  let feedCandidates = strictCandidates;

  if (strictCandidates.length < query.limit) {
    relaxed = true;
    relaxedReason = RELAXED_FEED_REASON;

    const alreadySelectedIds = toObjectIdList([
      ...excludedCandidateIds.map((id) => id.toString()),
      ...strictCandidates.map((candidate) => candidate._id.toString()),
    ]);
    const relaxedQuery = buildCandidateFeedQuery({
      candidateId: query.candidateId,
      excludedCandidateIds: alreadySelectedIds,
      preference,
      relaxed: true,
    });
    const relaxedCandidates = await findVisibleFeedCandidates({
      limit: poolSize,
      query: relaxedQuery,
    });

    feedCandidates = [...strictCandidates, ...relaxedCandidates];
  }

  return buildFeedResponseFromRankedCandidates({
    candidateId: query.candidateId,
    limit: query.limit,
    rankedCandidates: rankCandidates({
      candidates: feedCandidates,
      preference,
      viewerCandidate,
    }),
    relaxed,
    relaxedReason,
  });
};

export const SwipeService = {
  getSwipeFeed,
};
