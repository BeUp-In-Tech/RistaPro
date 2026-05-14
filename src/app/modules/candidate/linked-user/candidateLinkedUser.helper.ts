import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import AppError from '../../../errorHelpers/AppError';
import { ActiveStatus, Role } from '../../user/user.interface';
import User from '../../user/user.model';
import Candidate from '../candidate.model';
import {
  CANDIDATE_LINKED_USER_SORT_PRIORITY,
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserRelation,
  CandidateLinkedUserStatus,
  TActiveLinkedUserLean,
  TActiveLinkedUserWithUser,
  TLegacyCandidateAccessSeed,
  TLinkedUserAccessResponseShape,
} from './candidateLinkedUser.interface';
import CandidateLinkedUser from './candidateLinkedUser.model';
import { ensureNoOtherActiveCandidateAccess } from './candidateLinkedUser.access';
import {
  buildCandidateManagementSummary,
  isOwnerLinkedUser,
  mapLegacyRelationToLinkedRelation,
  TLinkedUserSafeUser,
} from './candidateLinkedUser.utility';

const LINKED_USER_CORE_SELECT =
  '_id candidate user name relationshipToCandidate accessRole status isPrimary linkedBy joinedAt removedAt createdAt updatedAt';
const LINKED_USER_MANAGEMENT_SELECT =
  'relationshipToCandidate accessRole status';

export const LINKED_USER_USER_SELECT =
  '_id full_name email picture role isVerified isActive';

export const LINKED_CANDIDATE_POPULATE_SELECT =
  '_id name dateOfBirth gender plan height religion sect caste profile_assist relationship_status have_children move_abroad occupation highest_education smoke_status drink_status interests personality relationToUser partnerExpectation bio images address coordinates isActive createdAt updatedAt';

export const buildMyAccessResponse = (
  linkedUser: TLinkedUserAccessResponseShape
) => ({
  _id: linkedUser._id,
  accessRole: linkedUser.accessRole,
  relationshipToCandidate: linkedUser.relationshipToCandidate,
  status: linkedUser.status,
  isPrimary: linkedUser.isPrimary,
  linkedBy: linkedUser.linkedBy,
  joinedAt: linkedUser.joinedAt,
});

export const sortLinkedUsersForResponse = (
  linkedUsers: TActiveLinkedUserWithUser[]
) => {
  linkedUsers.sort((firstLinkedUser, secondLinkedUser) => {
    if (firstLinkedUser.isPrimary !== secondLinkedUser.isPrimary) {
      return Number(secondLinkedUser.isPrimary) - Number(firstLinkedUser.isPrimary);
    }

    const firstRolePriority =
      CANDIDATE_LINKED_USER_SORT_PRIORITY[firstLinkedUser.accessRole];
    const secondRolePriority =
      CANDIDATE_LINKED_USER_SORT_PRIORITY[secondLinkedUser.accessRole];

    if (firstRolePriority !== secondRolePriority) {
      return firstRolePriority - secondRolePriority;
    }

    return (
      new Date(firstLinkedUser.createdAt ?? 0).getTime() -
      new Date(secondLinkedUser.createdAt ?? 0).getTime()
    );
  });
};

const getCandidateManagementRows = async (candidateId: string) =>
  CandidateLinkedUser.find({
    candidate: candidateId,
    status: CandidateLinkedUserStatus.ACTIVE,
  })
    .select(LINKED_USER_MANAGEMENT_SELECT)
    .lean<
      Pick<
        TActiveLinkedUserLean,
        'relationshipToCandidate' | 'accessRole' | 'status'
      >[]
    >();

export const getCandidateManagementSummary = async (candidateId: string) => {
  const managementRows = await getCandidateManagementRows(candidateId);
  return buildCandidateManagementSummary(managementRows);
};

export const clearOtherPrimaryLinkedUsers = async (params: {
  candidateId: string;
  excludeLinkedUserId?: string;
}) => {
  const { candidateId, excludeLinkedUserId } = params;

  await CandidateLinkedUser.updateMany(
    {
      ...(excludeLinkedUserId ? { _id: { $ne: excludeLinkedUserId } } : {}),
      candidate: candidateId,
      status: CandidateLinkedUserStatus.ACTIVE,
    },
    {
      $set: {
        isPrimary: false,
      },
    }
  );
};

export const findLinkedUserByCandidateAndUser = async (params: {
  candidateId: string;
  userId: Types.ObjectId | string;
}) => {
  const { candidateId, userId } = params;

  return CandidateLinkedUser.findOne({
    candidate: candidateId,
    user: userId,
  })
    .select(LINKED_USER_CORE_SELECT)
    .lean<TActiveLinkedUserLean | null>();
};

export const getActiveLinkedUserByIdOrThrow = async (params: {
  candidateId: string;
  linkedUserId: string;
}) => {
  const { candidateId, linkedUserId } = params;

  const existingLinkedUser = await CandidateLinkedUser.findOne({
    _id: linkedUserId,
    candidate: candidateId,
    status: CandidateLinkedUserStatus.ACTIVE,
  })
    .select(LINKED_USER_CORE_SELECT)
    .lean<TActiveLinkedUserLean | null>();

  if (!existingLinkedUser) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Linked user not found');
  }

  return existingLinkedUser;
};

export const getLinkedUserWithUserOrThrow = async (
  linkedUserId: Types.ObjectId | string
) => {
  const linkedUser = await CandidateLinkedUser.findById(linkedUserId)
    .populate({
      path: 'user',
      select: LINKED_USER_USER_SELECT,
    })
    .lean<TActiveLinkedUserWithUser | null>();

  if (!linkedUser) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to load the linked user record'
    );
  }

  return linkedUser;
};

const getCandidateByIdOrThrow = async (candidateId: string) => {
  const candidate = await Candidate.findById(candidateId)
    .select('_id user relationToUser isActive')
    .lean<TLegacyCandidateAccessSeed | null>();

  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  if (candidate.isActive !== ActiveStatus.ACTIVE) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Inactive candidate profiles cannot be managed'
    );
  }

  return candidate;
};

export const syncLegacyOwnerLinks = async (params: {
  userId: string;
  candidateIds?: string[];
}) => {
  const { userId, candidateIds } = params;

  const candidateFilter: {
    _id?: { $in: string[] };
    isActive: ActiveStatus;
    user: string;
  } = {
    user: userId,
    isActive: ActiveStatus.ACTIVE,
  };

  if (candidateIds?.length) {
    candidateFilter._id = { $in: candidateIds };
  }

  const legacyCandidates = await Candidate.find(candidateFilter)
    .select('_id name relationToUser')
    .lean<Pick<TLegacyCandidateAccessSeed, '_id' | 'name' | 'relationToUser'>[]>();

  if (!legacyCandidates.length) {
    return;
  }

  if (legacyCandidates.length > 1) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This account owns multiple active candidate profiles. Please resolve the duplicate assignments first'
    );
  }

  const candidateIdList = legacyCandidates.map((candidate) =>
    candidate._id.toString()
  );

  const existingLinks = await CandidateLinkedUser.find({
    candidate: { $in: candidateIdList },
    user: userId,
  })
    .select('candidate')
    .lean<{ candidate: Types.ObjectId }[]>();

  const existingLinkedCandidateIdSet = new Set(
    existingLinks.map((linkedUser) => linkedUser.candidate.toString())
  );

  const missingOwnerLinks = legacyCandidates
    .filter(
      (candidate) =>
        !existingLinkedCandidateIdSet.has(candidate._id.toString())
    )
    .map((candidate) => ({
      accessRole: CandidateLinkedUserAccessRole.OWNER,
      candidate: candidate._id,
      isPrimary: true,
      joinedAt: new Date(),
      linkedBy: new Types.ObjectId(userId),
      name: candidate.name ?? 'Candidate Owner',
      relationshipToCandidate: mapLegacyRelationToLinkedRelation(
        candidate.relationToUser
      ),
      status: CandidateLinkedUserStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    }));

  if (!missingOwnerLinks.length) {
    return;
  }

  try {
    await CandidateLinkedUser.insertMany(missingOwnerLinks, {
      ordered: false,
    });
  } catch (error) {
    const insertError = error as {
      code?: number;
      writeErrors?: unknown[];
    };

    if (insertError.code !== 11000 && !insertError.writeErrors?.length) {
      throw error;
    }
  }
};

export const getActiveLinkedUserAccessOrThrow = async (params: {
  userId: string;
  candidateId: string;
  requireOwner?: boolean;
}) => {
  const { candidateId, requireOwner = false, userId } = params;

  const candidate = await getCandidateByIdOrThrow(candidateId);
  await ensureNoOtherActiveCandidateAccess({
    userId,
    excludeCandidateId: candidateId,
    message:
      'This account is already linked to another active candidate profile',
  });
  await syncLegacyOwnerLinks({ userId, candidateIds: [candidateId] });

  const linkedUser = await CandidateLinkedUser.findOne({
    candidate: candidateId,
    status: CandidateLinkedUserStatus.ACTIVE,
    user: userId,
  })
    .select(LINKED_USER_CORE_SELECT)
    .lean<TActiveLinkedUserLean | null>();

  if (!linkedUser) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You do not have access to manage this candidate profile'
    );
  }

  if (requireOwner && !isOwnerLinkedUser(linkedUser.accessRole)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only candidate owners can manage linked users'
    );
  }

  return {
    access: linkedUser,
    candidate,
  };
};

export const ensureTargetUserCanBeLinked = async (params: {
  email: string;
  name: string;
  password?: string;
}) => {
  const { email, name, password } = params;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();

  let targetUser = await User.findOne({
    email: normalizedEmail,
    isDeleted: false,
  })
    .select(LINKED_USER_USER_SELECT)
    .lean<TLinkedUserSafeUser | null>();

  if (!targetUser) {
    if (!password?.trim()) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'Password is required to create a new linked user account'
      );
    }

    try {
      const createdUser = await User.create({
        auths: [
          {
            provider: 'credentials',
            providerId: normalizedEmail,
          },
        ],
        email: normalizedEmail,
        full_name: normalizedName,
        password,
        role: Role.USER,
      });

      targetUser = {
        _id: createdUser._id,
        email: createdUser.email,
        full_name: createdUser.full_name,
        isActive: createdUser.isActive,
        isVerified: createdUser.isVerified,
        picture: createdUser.picture,
        role: createdUser.role,
      };
    } catch (error) {
      const mongoError = error as { code?: number };

      if (mongoError.code !== 11000) {
        throw error;
      }

      targetUser = await User.findOne({
        email: normalizedEmail,
        isDeleted: false,
      })
        .select(LINKED_USER_USER_SELECT)
        .lean<TLinkedUserSafeUser | null>();

      if (!targetUser) {
        throw new AppError(
          StatusCodes.CONFLICT,
          'A deleted account already exists with this email. Please recover that account first'
        );
      }
    }
  }

  if (!targetUser) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      'Linked user account not found. Ask the user to register first'
    );
  }

  if (
    targetUser.isActive === ActiveStatus.INACTIVE ||
    targetUser.isActive === ActiveStatus.BLOCKED
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Inactive or blocked users cannot be linked to a candidate profile'
    );
  }

  return targetUser;
};

export const ensureSelfLinkConstraints = async (params: {
  candidateId: string;
  targetUserId: string;
  excludeLinkedUserId?: string;
}) => {
  const { candidateId, excludeLinkedUserId, targetUserId } = params;

  const existingSelfLinkedUser = await CandidateLinkedUser.findOne({
    _id: excludeLinkedUserId ? { $ne: excludeLinkedUserId } : { $exists: true },
    candidate: candidateId,
    relationshipToCandidate: CandidateLinkedUserRelation.SELF,
    status: CandidateLinkedUserStatus.ACTIVE,
  })
    .select('user')
    .lean<{ user: Types.ObjectId } | null>();

  if (
    existingSelfLinkedUser &&
    existingSelfLinkedUser.user.toString() !== targetUserId
  ) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This candidate profile already has an active self-linked account'
    );
  }
};

export const getActiveOwnerCount = async (
  candidateId: string,
  excludeId?: string
) =>
  CandidateLinkedUser.countDocuments({
    _id: excludeId ? { $ne: excludeId } : { $exists: true },
    accessRole: CandidateLinkedUserAccessRole.OWNER,
    candidate: candidateId,
    status: CandidateLinkedUserStatus.ACTIVE,
  });

export const syncCandidatePrimaryOwner = async (
  candidateId: string,
  primaryUserId: Types.ObjectId | string
) => {
  await Candidate.findByIdAndUpdate(candidateId, {
    $set: {
      user:
        primaryUserId instanceof Types.ObjectId
          ? primaryUserId
          : new Types.ObjectId(primaryUserId),
    },
  });
};
