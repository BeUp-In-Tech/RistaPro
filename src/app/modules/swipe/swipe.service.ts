import { Types } from 'mongoose';
import { getActiveLinkedUserAccessOrThrow } from '../candidate/linked-user/candidateLinkedUser.helper';
import {
  ISwipeActionPayload,
  ISwipeActionResponse,
  ISwipeFeedQuery,
  ISwipeFeedResponse,
  TSwipeMatchLean,
} from './swipe.interface';
import {
  acquireSwipeActionLock,
  assertCanPerformSwipeAction,
  assertDifferentSwipeCandidates,
  assertNoSwipeReportBetweenCandidates,
  assertSwipeQuotaAvailable,
  assertValidFeedCandidateId,
  buildCandidateFeedQuery,
  buildFeedResponseFromRankedCandidates,
  buildSwipeActionResponse,
  buildSwipeQuotaResponse,
  clearSwipeFeedSessionsForCandidate,
  createOrGetActiveSwipeMatch,
  createSwipeActionOrGetExisting,
  filterStrictCandidates,
  findActiveSwipeMatch,
  findExistingSwipeAction,
  findPositiveReverseSwipeAction,
  findVisibleFeedCandidates,
  getExcludedCandidateIds,
  getFeedFromCachedSession,
  getFeedPoolSize,
  getFeedPreferenceOrCreateDefault,
  getSwipePlanOrDefault,
  getSwipeQuotaCandidateOrThrow,
  getSwipeTargetCandidateOrThrow,
  getViewerCandidateOrThrow,
  isPositiveSwipeAction,
  rankCandidates,
  releaseSwipeActionLock,
  returnExistingMatchedActionOrThrow,
  returnExistingSwipeAction,
  toObjectIdList,
} from './swipe.helper';



// GET /swipes/feed - Builds the Tinder-style discovery stack for one candidate profile.
const getSwipeFeed = async (
  userId: string,
  query: ISwipeFeedQuery
): Promise<ISwipeFeedResponse> => {
  assertValidFeedCandidateId(query.candidateId);

  // View access is enough for the feed; VIEWER users can browse but cannot swipe.
  await getActiveLinkedUserAccessOrThrow({
    candidateId: query.candidateId,
    userId,
  });

  const viewerCandidate = await getViewerCandidateOrThrow(query.candidateId);

  // Cursor requests should reuse the previously ranked candidate ids when Redis still has them.
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

  // First page builds fresh preferences and exclusions in parallel for fast startup.
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

  let feedCandidates = strictCandidates;
  let relaxed = false;
  let relaxedReason: string | undefined;

  // If strict preferences are too narrow, relax optional filters to keep discovery alive.
  if (strictCandidates.length < query.limit) {
    relaxed = true;
    relaxedReason = 'Not enough candidates matched all strict preferences';

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
    viewerCandidate,
  });
};

// POST /swipes/action - Saves LIKE/SUPER_LIKE/PASS and creates a match on mutual positive swipes.
const performSwipeAction = async (
  userId: string,
  payload: ISwipeActionPayload
): Promise<ISwipeActionResponse> => {
  assertValidFeedCandidateId(payload.candidateId);
  assertValidFeedCandidateId(payload.targetCandidateId);
  assertDifferentSwipeCandidates(
    payload.candidateId,
    payload.targetCandidateId
  );

  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId: payload.candidateId,
    userId,
  });
  assertCanPerformSwipeAction(access.accessRole);

  // The Redis lock reduces double-tap races; Mongo unique indexes remain the final guard.
  const lock = await acquireSwipeActionLock({
    candidateId: payload.candidateId,
    targetCandidateId: payload.targetCandidateId,
  });

  try {
    // Target availability and report blocking can be checked together.
    await Promise.all([
      getSwipeTargetCandidateOrThrow(payload.targetCandidateId),
      assertNoSwipeReportBetweenCandidates({
        candidateId: payload.candidateId,
        targetCandidateId: payload.targetCandidateId,
      }),
    ]);

    const quotaCandidate = await getSwipeQuotaCandidateOrThrow(
      payload.candidateId
    );
    const plan = await getSwipePlanOrDefault(quotaCandidate.plan);
    const currentQuota = () =>
      buildSwipeQuotaResponse({ candidateId: payload.candidateId, plan });

    const [existingAction, existingMatch] = await Promise.all([
      findExistingSwipeAction({
        candidateId: payload.candidateId,
        targetCandidateId: payload.targetCandidateId,
      }),
      findActiveSwipeMatch({
        candidateId: payload.candidateId,
        targetCandidateId: payload.targetCandidateId,
      }),
    ]);

    // An existing active match makes new actions invalid, but idempotent retries stay safe.
    if (existingMatch) {
      return await returnExistingMatchedActionOrThrow({
        action: existingAction,
        candidateId: payload.candidateId,
        match: existingMatch,
        quota: await currentQuota(),
        targetCandidateId: payload.targetCandidateId,
        type: payload.type,
      });
    }

    if (existingAction) {
      return await returnExistingSwipeAction({
        action: existingAction,
        candidateId: payload.candidateId,
        quota: await currentQuota(),
        targetCandidateId: payload.targetCandidateId,
        type: payload.type,
      });
    }

    await assertSwipeQuotaAvailable({
      candidateId: payload.candidateId,
      plan,
      type: payload.type,
    });

    const { action, created } = await createSwipeActionOrGetExisting({
      actedBy: userId,
      candidateId: payload.candidateId,
      source: payload.source,
      targetCandidateId: payload.targetCandidateId,
      type: payload.type,
    });

    if (!created) {
      return await returnExistingSwipeAction({
        action,
        candidateId: payload.candidateId,
        quota: await currentQuota(),
        targetCandidateId: payload.targetCandidateId,
        type: payload.type,
      });
    }

    let match: TSwipeMatchLean | null = null;
    if (isPositiveSwipeAction(payload.type)) {
      const reverseAction = await findPositiveReverseSwipeAction({
        candidateId: payload.candidateId,
        targetCandidateId: payload.targetCandidateId,
      });

      if (reverseAction) {
        match = await createOrGetActiveSwipeMatch({
          candidateId: payload.candidateId,
          matchedBy: payload.candidateId,
          targetCandidateId: payload.targetCandidateId,
        });
      }
    }

    void clearSwipeFeedSessionsForCandidate(payload.candidateId).catch(
      () => undefined
    );

    return buildSwipeActionResponse({
      action,
      candidateId: payload.candidateId,
      match,
      quota: await currentQuota(),
      targetCandidateId: payload.targetCandidateId,
    });
  } finally {
    await releaseSwipeActionLock(lock);
  }
};

export const SwipeService = {
  getSwipeFeed,
  performSwipeAction,
};
