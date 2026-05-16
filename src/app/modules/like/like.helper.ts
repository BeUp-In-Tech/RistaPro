import { FilterQuery, Types } from 'mongoose';
import { QueryBuilder } from '../../utils/QueryBuilder';
import { PLANS } from '../plan/plan.constant';
import { IPlan, PLAN_KEYS, PlanKey } from '../plan/plan.interface';
import PlanModel from '../plan/plan.model';
import { ActiveStatus } from '../user/user.interface';
import {
  ILike,
  ILikeCandidateCard,
  ILikeListItem,
  ILikeListQuery,
  ILikeListResponse,
  LikeType,
  TLikeCandidateLean,
  TLikeWithCandidate,
} from './like.interface';
import Like from './like.model';

const CANDIDATE_CARD_SELECT =
  '_id name dateOfBirth gender images religion address isActive user';

// Falls back to free when older candidate data has no valid plan key.
export const getPlanKeyOrDefault = (plan?: string): PlanKey =>
  PLAN_KEYS.includes(plan as PlanKey) ? (plan as PlanKey) : 'free';

// Calculates age from date of birth for the small like-card response.
export const getAgeFromDateOfBirth = (dateOfBirth: Date) => {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }

  return age;
};

// Keeps PASS out of both list APIs while allowing LIKE/SUPER_LIKE filtering.
export const getLikeTypeQuery = (type?: LikeType.LIKE | LikeType.SUPER_LIKE) =>
  type ?? { $in: [LikeType.LIKE, LikeType.SUPER_LIKE] };

// Hides inactive candidates and candidates whose owner account is unavailable.
export const isVisibleCandidate = (candidate: TLikeCandidateLean | null) => {
  if (!candidate || candidate.isActive !== ActiveStatus.ACTIVE) {
    return false;
  }

  const owner =
    candidate.user &&
    typeof candidate.user === 'object' &&
    'isActive' in candidate.user
      ? candidate.user
      : null;

  return Boolean(
    owner &&
    owner.isActive === ActiveStatus.ACTIVE &&
    !owner.isDeleted &&
    owner.isVerified
  );
};

// Shapes a candidate into the public card shown in like lists.
export const buildCandidateCard = (
  candidate: TLikeCandidateLean
): ILikeCandidateCard => ({
  _id: candidate._id,
  age: getAgeFromDateOfBirth(candidate.dateOfBirth),
  gender: candidate.gender,
  images: candidate.images ?? [],
  livesIn: candidate.address?.split(',')[0]?.trim() || undefined,
  name: candidate.name,
  religion: candidate.religion,
});

// Converts populated Like rows into response items and drops hidden candidates.
export const buildLikeListItems = (
  likes: TLikeWithCandidate[],
  candidateField: 'likedBy' | 'likedProfile'
): ILikeListItem[] => {
  const items: ILikeListItem[] = [];

  for (const like of likes) {
    const candidate = like[candidateField];

    if (
      !candidate ||
      candidate instanceof Types.ObjectId ||
      !isVisibleCandidate(candidate)
    ) {
      continue;
    }

    items.push({
      _id: like._id,
      candidate: buildCandidateCard(candidate),
      createdAt: like.createdAt,
      source: like.source,
      type: like.type,
    });
  }

  return items;
};

// Reads active plan config, falling back to static defaults in local/dev data.
export const getPlanWithSeeWhoLiked = async (plan?: string) => {
  const planKey = getPlanKeyOrDefault(plan);
  const planDocument = await PlanModel.findOne({
    isActive: true,
    key: planKey,
  })
    .select('canSeeWhoLiked')
    .lean<Pick<IPlan, 'canSeeWhoLiked'> | null>();

  return planDocument ?? PLANS[planKey];
};

// Fetches likes with secure base filters, then paginates only visible candidates.
export const getLikes = async (params: {
  candidateField: 'likedBy' | 'likedProfile';
  query: ILikeListQuery;
  targetField: 'likedBy' | 'likedProfile';
}): Promise<ILikeListResponse> => {
  const { candidateField, query, targetField } = params;
  const filter: FilterQuery<ILike> = {
    [candidateField]: query.candidateId,
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
    type: getLikeTypeQuery(query.type),
  };

  const queryBuilder = new QueryBuilder(
    Like.find(filter).populate({
      match: {
        isActive: ActiveStatus.ACTIVE,
      },
      path: targetField,
      select: CANDIDATE_CARD_SELECT,
      populate: {
        match: {
          isActive: ActiveStatus.ACTIVE,
          isDeleted: false,
          isVerified: true,
        },
        path: 'user',
        select: '_id isActive isDeleted isVerified',
      },
    }),
    {
      sort: query.sort ?? '-type -createdAt',
    }
  );

  const likes = (await queryBuilder
    .sort()
    .build()
    .lean()) as unknown as TLikeWithCandidate[];

  const visibleLikes = buildLikeListItems(likes, targetField);
  const total = visibleLikes.length;
  const skip = (query.page - 1) * query.limit;
  const data = visibleLikes.slice(skip, skip + query.limit);

  return {
    data,
    meta: {
      limit: query.limit,
      page: query.page,
      total,
      totalPage: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};
