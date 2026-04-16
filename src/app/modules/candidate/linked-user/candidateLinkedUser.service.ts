import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';
import env from '../../../config/env';
import AppError from '../../../errorHelpers/AppError';
import { sendMailByBullMQ } from '../../../utils/backgroundJobProcessingHelper';
import { buildCandidateResponse } from '../candidate.utility';
import Candidate from '../candidate.model';
import User from '../../user/user.model';
import CandidateLinkedUser from './candidateLinkedUser.model';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserRelation,
  CandidateLinkedUserStatus,
  ICreateCandidateLinkedUserPayload,
  IUpdateCandidateLinkedUserPayload,
  TActiveLinkedUserWithUser,
  TCandidateProfileLean,
  TMyLinkedCandidateRow,
} from './candidateLinkedUser.interface';
import {
  ensureNoOtherActiveCandidateAccess,
  ensureSingleActiveCandidateAccessOrThrow,
} from './candidateLinkedUser.access';
import {
  buildCandidateLinkedUserResponse,
  buildCandidateManagementSummary,
  getDefaultLinkedUserAccessRole,
  isOwnerLinkedUser,
} from './candidateLinkedUser.utility';
import {
  LINKED_CANDIDATE_POPULATE_SELECT,
  LINKED_USER_USER_SELECT,
  buildMyAccessResponse,
  clearOtherPrimaryLinkedUsers,
  ensureSelfLinkConstraints,
  ensureTargetUserCanBeLinked,
  findLinkedUserByCandidateAndUser,
  getActiveLinkedUserAccessOrThrow,
  getActiveLinkedUserByIdOrThrow,
  getActiveOwnerCount,
  getCandidateManagementSummary,
  getLinkedUserWithUserOrThrow,
  sortLinkedUsersForResponse,
  syncCandidatePrimaryOwner,
  syncLegacyOwnerLinks,
} from './candidateLinkedUser.helper';
import { redisClient } from '../../../config/redis.config';

/*
  Reading Guide (suggested order):
  1) addCandidateLinkedUser
  2) updateCandidateLinkedUser
  3) removeCandidateLinkedUser
  4) getCandidateLinkedUsers
  5) getMyLinkedCandidates
  Helper/query logic lives in: candidateLinkedUser.helper.ts
*/

// 1. GET LINKED USERS LIST OF CANDIDATE
const getCandidateLinkedUsers = async (userId: string, candidateId: string) => {
  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId,
    userId,
  });

  const linkedUsers = await CandidateLinkedUser.find({
    candidate: candidateId,
    status: CandidateLinkedUserStatus.ACTIVE,
  })
    .populate({
      path: 'user',
      select: LINKED_USER_USER_SELECT,
    })
    .lean<TActiveLinkedUserWithUser[]>();

  sortLinkedUsersForResponse(linkedUsers);

  return {
    candidateId,
    management: buildCandidateManagementSummary(linkedUsers),
    myAccess: buildMyAccessResponse(access),
    users: linkedUsers.map(buildCandidateLinkedUserResponse),
  };
};

// 1. ADD LINKED USER
const addCandidateLinkedUser = async (
  authUserId: string,
  candidateId: string,
  payload: ICreateCandidateLinkedUserPayload
) => {
  // 1) Ownership/access guard for mutation APIs.
  await getActiveLinkedUserAccessOrThrow({
    candidateId,
    requireOwner: true,
    userId: authUserId,
  });

  // 2) Resolve the target account.
  const linkedUserName = payload.name.trim();
  const targetUser = await ensureTargetUserCanBeLinked({
    email: payload.email,
    name: linkedUserName,
    password: payload.password,
  });

  const relationshipToCandidate = payload.relationshipToCandidate;
  const resolvedAccessRole =
    payload.accessRole ?? getDefaultLinkedUserAccessRole(relationshipToCandidate);
  const shouldBePrimary = payload.isPrimary ?? false;

  // 3) Guard role/relationship constraints.
  if (shouldBePrimary && resolvedAccessRole !== CandidateLinkedUserAccessRole.OWNER) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Primary linked users must have owner access role'
    );
  }

  if (relationshipToCandidate === CandidateLinkedUserRelation.SELF) {
    await ensureSelfLinkConstraints({
      candidateId,
      targetUserId: targetUser._id.toString(),
    });
  }

  await ensureNoOtherActiveCandidateAccess({
    userId: targetUser._id.toString(),
    excludeCandidateId: candidateId,
    message: 'This user is already linked to another active candidate profile',
  });

  const existingLink = await findLinkedUserByCandidateAndUser({
    candidateId,
    userId: targetUser._id,
  });

  if (existingLink?.status === CandidateLinkedUserStatus.ACTIVE) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'This user is already linked to the candidate profile'
    );
  }

  // 4) Keep only one primary linked user per candidate.
  if (shouldBePrimary) {
    await clearOtherPrimaryLinkedUsers({ candidateId });
  }

  let linkedUserId = existingLink?._id;

  // 5) Reactivate existing relation or create a fresh one.
  if (existingLink) {
    const updatedLinkedUser = await CandidateLinkedUser.findByIdAndUpdate(
      existingLink._id,
      {
        $set: {
          accessRole: resolvedAccessRole,
          isPrimary: shouldBePrimary,
          joinedAt: existingLink.joinedAt ?? new Date(),
          linkedBy: new Types.ObjectId(authUserId),
          name: linkedUserName,
          relationshipToCandidate,
          removedAt: undefined,
          status: CandidateLinkedUserStatus.ACTIVE,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .select('_id')
      .lean<{ _id: Types.ObjectId } | null>();

    linkedUserId = updatedLinkedUser?._id;
  } else {
    const createdLinkedUser = await CandidateLinkedUser.create({
      accessRole: resolvedAccessRole,
      candidate: new Types.ObjectId(candidateId),
      isPrimary: shouldBePrimary,
      linkedBy: new Types.ObjectId(authUserId),
      name: linkedUserName,
      relationshipToCandidate,
      status: CandidateLinkedUserStatus.ACTIVE,
      user: targetUser._id,
    });

    linkedUserId = createdLinkedUser._id;
  }

  // 6) Build response payload.
  if (!linkedUserId) {
    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to resolve linked user id after upsert'
    );
  }

  const linkedUser = await getLinkedUserWithUserOrThrow(linkedUserId);

  if (shouldBePrimary) {
    await syncCandidatePrimaryOwner(candidateId, targetUser._id);
  }

  const [ownerUser, candidate] = await Promise.all([
    User.findById(authUserId).select('full_name').lean<{ full_name: string } | null>(),
    Candidate.findById(candidateId).select('name').lean<{ name: string } | null>(),
  ]);

  await sendMailByBullMQ(
    {
      to: targetUser.email,
      subject: 'You have been added to RistaPro',
      templateName: 'linkedUserGreet',
      templateData: {
        ownerName: ownerUser?.full_name ?? 'A RistaPro member',
        candidateName: candidate?.name ?? 'the candidate',
        linkedUserName,
        linkedUserEmail: targetUser.email,
        tempPassword: payload.password ?? 'Use your existing password',
        loginUrl: `${env.FRONTEND_URL}/login`,
        supportEmail: env.EMAIL_USER,
        termsOfService: `${env.FRONTEND_URL}/terms-of-service`,
        privacyUrl: `${env.FRONTEND_URL}/privacy-policy`,
      },
    },
    `linked_user_greet_${linkedUserId.toString()}_${Date.now()}`
  );

  return {
    management: await getCandidateManagementSummary(candidateId),
    linkedUser: buildCandidateLinkedUserResponse(linkedUser),
  };
};

// 3. UPDATE LINKED USER
const updateCandidateLinkedUser = async (
  authUserId: string,
  candidateId: string,
  linkedUserId: string,
  payload: IUpdateCandidateLinkedUserPayload
) => {
  // 1) Access guard.
  const { access: authAccess } = await getActiveLinkedUserAccessOrThrow({
    candidateId,
    userId: authUserId,
  });

  const existingLinkedUser = await getActiveLinkedUserByIdOrThrow({
    candidateId,
    linkedUserId,
  });

  const isAuthOwner = isOwnerLinkedUser(authAccess.accessRole);
  const isSelfUpdate = existingLinkedUser.user.toString() === authUserId;

  if (!isAuthOwner && !isSelfUpdate) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Only candidate owners can manage other linked users'
    );
  }

  // 2) Linked users (non-owner) can update only their own basic profile info.
  if (!isAuthOwner) {
    if (
      payload.accessRole !== undefined ||
      payload.isPrimary !== undefined ||
      payload.relationshipToCandidate !== undefined
    ) {
      throw new AppError(
        StatusCodes.FORBIDDEN,
        'Linked users can only update their own basic profile info'
      );
    }

    const linkedUserUpdatePayload: { name?: string } = {};
    const userUpdatePayload: { full_name?: string } = {};

    if (payload.name !== undefined) {
      const trimmedName = payload.name.trim();
      linkedUserUpdatePayload.name = trimmedName;
      userUpdatePayload.full_name = trimmedName;
    }

    if (Object.keys(linkedUserUpdatePayload).length === 0) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'At least one valid field is required to update'
      );
    }

    const updatedLinkedUser = await CandidateLinkedUser.findByIdAndUpdate(
      linkedUserId,
      {
        $set: linkedUserUpdatePayload,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate({
        path: 'user',
        select: LINKED_USER_USER_SELECT,
      })
      .lean<TActiveLinkedUserWithUser | null>();

    if (!updatedLinkedUser) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Linked user not found');
    }

    if (Object.keys(userUpdatePayload).length > 0) {
      await User.findByIdAndUpdate(
        existingLinkedUser.user,
        {
          $set: userUpdatePayload,
        },
        {
          runValidators: true,
        }
      );
    }

    // INVALIDATE CACHED
    await redisClient.del(`get_me:${existingLinkedUser.user.toString()}`); // INVALID LINKED USER OWN DATA

    return {
      management: await getCandidateManagementSummary(candidateId),
      linkedUser: buildCandidateLinkedUserResponse(updatedLinkedUser),
    };
  }

  const resolvedAccessRole = payload.accessRole ?? existingLinkedUser.accessRole;
  const shouldBePrimary = payload.isPrimary ?? existingLinkedUser.isPrimary;
  const resolvedRelation =
    payload.relationshipToCandidate ?? existingLinkedUser.relationshipToCandidate;

  // 3) Cross-profile and role constraints.
  await ensureNoOtherActiveCandidateAccess({
    userId: existingLinkedUser.user.toString(),
    excludeCandidateId: candidateId,
    message: 'This user is already linked to another active candidate profile',
  });

  if (shouldBePrimary && resolvedAccessRole !== CandidateLinkedUserAccessRole.OWNER) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Primary linked users must have owner access role'
    );
  }

  if (!shouldBePrimary && existingLinkedUser.isPrimary) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Promote another owner as primary before removing primary access'
    );
  }

  if (
    isOwnerLinkedUser(existingLinkedUser.accessRole) &&
    !isOwnerLinkedUser(resolvedAccessRole)
  ) {
    const remainingOwnerCount = await getActiveOwnerCount(
      candidateId,
      existingLinkedUser._id.toString()
    );

    if (remainingOwnerCount === 0) {
      throw new AppError(
        StatusCodes.CONFLICT,
        'At least one active owner must remain on the candidate profile'
      );
    }
  }

  if (resolvedRelation === CandidateLinkedUserRelation.SELF) {
    await ensureSelfLinkConstraints({
      candidateId,
      excludeLinkedUserId: linkedUserId,
      targetUserId: existingLinkedUser.user.toString(),
    });
  }

  // 4) Keep primary ownership coherent.
  if (shouldBePrimary) {
    await clearOtherPrimaryLinkedUsers({
      candidateId,
      excludeLinkedUserId: linkedUserId,
    });
  }

  const updatedLinkedUser = await CandidateLinkedUser.findByIdAndUpdate(
    linkedUserId,
    {
      $set: {
        accessRole: resolvedAccessRole,
        isPrimary: shouldBePrimary,
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
        relationshipToCandidate: resolvedRelation,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  )
    .populate({
      path: 'user',
      select: LINKED_USER_USER_SELECT,
    })
    .lean<TActiveLinkedUserWithUser | null>();

  if (!updatedLinkedUser) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Linked user not found');
  }

  if (shouldBePrimary) {
    await syncCandidatePrimaryOwner(candidateId, existingLinkedUser.user);
  }

  return {
    management: await getCandidateManagementSummary(candidateId),
    linkedUser: buildCandidateLinkedUserResponse(updatedLinkedUser),
  };
};

// 4. REMOVE LINKED USER
const removeCandidateLinkedUser = async (
  authUserId: string,
  candidateId: string,
  linkedUserId: string
) => {
  // 1) Ownership/access guard for mutation APIs.
  await getActiveLinkedUserAccessOrThrow({
    candidateId,
    requireOwner: true,
    userId: authUserId,
  });

  const existingLinkedUser = await getActiveLinkedUserByIdOrThrow({
    candidateId,
    linkedUserId,
  });

  if (existingLinkedUser.isPrimary) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Primary linked user cannot be removed. Promote another owner first'
    );
  }

  if (isOwnerLinkedUser(existingLinkedUser.accessRole)) {
    const remainingOwnerCount = await getActiveOwnerCount(
      candidateId,
      linkedUserId
    );

    if (remainingOwnerCount === 0) {
      throw new AppError(
        StatusCodes.CONFLICT,
        'At least one active owner must remain on the candidate profile'
      );
    }
  }

  await CandidateLinkedUser.findByIdAndUpdate(
    linkedUserId,
    {
      $set: {
        isPrimary: false,
        removedAt: new Date(),
        status: CandidateLinkedUserStatus.REMOVED,
      },
    },
    {
      runValidators: true,
    }
  );

  return null;
};

// 5. GET MY LINKED CANDIDATES
const getMyLinkedCandidates = async (userId: string) => {
  const activeCandidateAccesses = await ensureSingleActiveCandidateAccessOrThrow({
    userId,
    message:
      'This account is linked to multiple active candidate profiles. Please resolve the duplicate assignments first',
  });

  if (!activeCandidateAccesses.length) {
    return [];
  }

  const candidateIds = activeCandidateAccesses.map((access) => access.candidateId);
  await syncLegacyOwnerLinks({ userId, candidateIds });

  const linkedCandidate = await CandidateLinkedUser.findOne({
    candidate: { $in: candidateIds },
    user: userId,
    status: CandidateLinkedUserStatus.ACTIVE,
  })
    .populate({
      path: 'candidate',
      select: LINKED_CANDIDATE_POPULATE_SELECT,
    })
    .lean<TMyLinkedCandidateRow | null>();

  if (!linkedCandidate?.candidate) {
    return [];
  }

  const candidate = linkedCandidate.candidate as TCandidateProfileLean;
  return [
    {
      candidate: buildCandidateResponse(candidate),
      management: await getCandidateManagementSummary(candidate._id.toString()),
      myAccess: buildMyAccessResponse(linkedCandidate),
    },
  ];
};

export const CandidateLinkedUserService = {
  addCandidateLinkedUser,
  getCandidateLinkedUsers,
  getMyLinkedCandidates,
  removeCandidateLinkedUser,
  updateCandidateLinkedUser,
};
