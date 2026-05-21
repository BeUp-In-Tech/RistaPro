import { Types } from 'mongoose';
import { reverseGeocodeCoordinates } from '../../utils/reverseGeocode';
import { getActiveLinkedUserAccessOrThrow } from '../candidate/linked-user/candidateLinkedUser.helper';
import {
  INearbyMatchesQuery,
  INearbyMatchesResponse,
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
  assertNoMarriedCandidateInPair,
  assertSwipeQuotaAvailable,
  assertValidFeedCandidateId,
  buildNearbyMatchCards,
  buildNearbyMatchesResponse,
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
  formatNearbyLivesIn,
  hasValidCoordinates,
  getNearbyRadiusKm,
  getNearbySearchLocation,
  NEARBY_MATCH_POOL_SIZE,
  getSwipePlanOrDefault,
  getSwipeQuotaCandidateOrThrow,
  getSwipeTargetCandidateOrThrow,
  getViewerCandidateOrThrow,
  isPositiveSwipeAction,
  rankCandidates,
  releaseSwipeActionLock,
  returnExistingMatchedActionOrThrow,
  returnExistingSwipeAction,
  shuffleFeedCandidates,
  toObjectIdList,
} from './swipe.helper';
import AppError from '../../errorHelpers/AppError';
import { StatusCodes } from 'http-status-codes';
import { RishtaProgressService } from '../rishta_progress/rishta_progress.service';
import {
  RishtaProgressStep,
  RishtaProgressStepSource,
} from '../rishta_progress/rishta_progress.interface';



// Returns preference-matching profiles near the requester location.
const getNearbyMatches = async (
  userId: string,
  query: INearbyMatchesQuery
): Promise<INearbyMatchesResponse> => {
  const { ensureSingleActiveCandidateAccessOrThrow } = await import(
    '../candidate/linked-user/candidateLinkedUser.access'
  );
  
  const accesses = await ensureSingleActiveCandidateAccessOrThrow({ userId });
  if (!accesses.length) {
    throw new AppError(StatusCodes.NOT_FOUND, 'No active candidate profile found for this user');
  }
  const candidateId = accesses[0].candidateId;

  assertValidFeedCandidateId(candidateId);

  // Only linked users can discover from a private candidate profile.
  await getActiveLinkedUserAccessOrThrow({
    candidateId,
    userId,
  });

  const viewerCandidate = await getViewerCandidateOrThrow(candidateId);
  const searchLocation = getNearbySearchLocation({
    viewerCandidate,
  });
  const viewerCandidateFromSearchLocation = {
    ...viewerCandidate,
    coordinates: searchLocation.coordinates,
  };

  const [preference, excludedCandidateIds, currentLocation] =
    await Promise.all([
      getFeedPreferenceOrCreateDefault({
        candidateGender: viewerCandidate.gender,
        candidateId,
        createdBy: viewerCandidate.user as Types.ObjectId,
      }),
      getExcludedCandidateIds(candidateId),
      reverseGeocodeCoordinates(
        searchLocation.coordinates[1],
        searchLocation.coordinates[0]
      ),
    ]);
  const radiusKm = getNearbyRadiusKm(query.radiusKm, preference.maxDistanceKm);
  const nearbyPreference = {
    ...preference,
    maxDistanceKm: radiusKm,
  };
  const strictQuery = buildCandidateFeedQuery({
    candidateId,
    excludedCandidateIds,
    preference: nearbyPreference,
    viewerGender: viewerCandidate.gender,
  });
  const strictCandidates = filterStrictCandidates({
    candidates: await findVisibleFeedCandidates({
      limit: NEARBY_MATCH_POOL_SIZE,
      query: strictQuery,
    }),
    preference: nearbyPreference,
    viewerCandidate: viewerCandidateFromSearchLocation,
  });
  const cards = buildNearbyMatchCards({
    candidates: strictCandidates,
    preference: nearbyPreference,
    radiusKm,
    viewerCandidate: viewerCandidateFromSearchLocation,
  });

  const response = buildNearbyMatchesResponse({
    currentLocation,
    limit: query.limit,
    origin: searchLocation.origin,
    page: query.page,
    radiusKm,
    cards,
  });

  const candidateById = new Map(
    strictCandidates.map((candidate) => [candidate._id.toString(), candidate])
  );

  for (const card of response.data) {
    if (card.livesIn) {
      continue;
    }

    const candidate = candidateById.get(card._id.toString());
    if (!candidate || !hasValidCoordinates(candidate.coordinates)) {
      continue;
    }

    const [longitude, latitude] = candidate.coordinates as number[];
    const formattedAddress = await reverseGeocodeCoordinates(
      latitude,
      longitude
    );
    const livesIn = formatNearbyLivesIn(formattedAddress);

    if (livesIn) {
      card.livesIn = livesIn;
    }
  }

  return response;
};

// Builds the Tinder-style discovery stack for one candidate profile.
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
    viewerGender: viewerCandidate.gender,
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
      viewerGender: viewerCandidate.gender,
    });
    const relaxedCandidates = await findVisibleFeedCandidates({
      limit: poolSize,
      query: relaxedQuery,
    });

    feedCandidates = [...strictCandidates, ...relaxedCandidates];
  }

  const rankedCandidates = rankCandidates({
    candidates: feedCandidates,
    preference,
    viewerCandidate,
  });

  return buildFeedResponseFromRankedCandidates({
    candidateId: query.candidateId,
    limit: query.limit,
    rankedCandidates: query.cursor
      ? rankedCandidates
      : shuffleFeedCandidates(rankedCandidates),
    relaxed,
    relaxedReason,
    viewerCandidate,
  });
};

// Saves LIKE/SUPER_LIKE/PASS and creates a match on mutual positive swipes.
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
      assertNoMarriedCandidateInPair({
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
      const response = await returnExistingMatchedActionOrThrow({
        action: existingAction,
        candidateId: payload.candidateId,
        match: existingMatch,
        quota: await currentQuota(),
        targetCandidateId: payload.targetCandidateId,
        type: payload.type,
      });

      if (response.match) {
        await RishtaProgressService.completeAutomaticStep({
          candidateIds: response.match.candidates,
          completedBy: userId,
          conversationId: response.match.conversation,
          matchId: response.match._id,
          source: RishtaProgressStepSource.MATCH_CREATED,
          step: RishtaProgressStep.MATCHES,
        });
      }

      return response;
    }

    if (existingAction) {
      const response = await returnExistingSwipeAction({
        action: existingAction,
        candidateId: payload.candidateId,
        quota: await currentQuota(),
        targetCandidateId: payload.targetCandidateId,
        type: payload.type,
      });

      if (response.match) {
        await RishtaProgressService.completeAutomaticStep({
          candidateIds: response.match.candidates,
          completedBy: userId,
          conversationId: response.match.conversation,
          matchId: response.match._id,
          source: RishtaProgressStepSource.MATCH_CREATED,
          step: RishtaProgressStep.MATCHES,
        });
      }

      return response;
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

        await RishtaProgressService.completeAutomaticStep({
          candidateIds: match.candidates,
          completedBy: userId,
          conversationId: match.conversation,
          matchId: match._id,
          source: RishtaProgressStepSource.MATCH_CREATED,
          step: RishtaProgressStep.MATCHES,
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
  getNearbyMatches,
  getSwipeFeed,
  performSwipeAction,
};
