import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errorHelpers/AppError';
import { deleteImageByBullMQ } from '../../utils/backgroundJobProcessingHelper';
import { ActiveStatus } from '../user/user.interface';
import User from '../user/user.model';
import Candidate from './candidate.model';
import {
  ICandidateProfileFields,
  ICreateCandidatePayload,
  IUpdateCandidatePayload,
  IUpdateCandidateRequestPayload,
  IVerificationStatus,
  RelationToUser,
} from './candidate.interface';
import {
  buildCandidateLabels,
  buildCandidateCreatePayload,
  buildCandidateResponse,
  buildCandidateUpdatePayload,
  hasVerificationBadge,
  MAX_CANDIDATE_IMAGES,
  normalizeArrayValues,
  normalizeImageLinks,
} from './candidate.utility';
import CandidateLinkedUser from './linked-user/candidateLinkedUser.model';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserStatus,
} from './linked-user/candidateLinkedUser.interface';
import { ensureNoOtherActiveCandidateAccess } from './linked-user/candidateLinkedUser.access';
import {
  buildCandidateManagementSummary,
  mapLegacyRelationToLinkedRelation,
} from './linked-user/candidateLinkedUser.utility';
import { getActiveLinkedUserAccessOrThrow } from './linked-user/candidateLinkedUser.helper';
import {
  deleteCandidatePreferenceByCandidateId,
  ensureDefaultCandidatePreference,
} from '../candidate-preference/candidatePreference.service';
import { InterestKey, PersonalityKey } from '../../constant/constant';
import { PLAN_KEYS, PlanKey, IPlan } from '../plan/plan.interface';
import { PLANS } from '../plan/plan.constant';
import PlanModel from '../plan/plan.model';
import Report from '../report/report.model';
import RishtaProgress from '../rishta_progress/rishta_progress.model';
import { RishtaProgressStatus } from '../rishta_progress/rishta_progress.interface';

type TFullProfileCandidateLean = ICandidateProfileFields & {
  _id: Types.ObjectId;
  user:
    | Types.ObjectId
    | {
        _id: Types.ObjectId;
        isActive?: ActiveStatus;
        isDeleted?: boolean;
        isVerified?: boolean;
      }
    | null;
  verification_status?: IVerificationStatus;
  isActive: ActiveStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

const FULL_PROFILE_CANDIDATE_SELECT =
  '_id name dateOfBirth gender height religion sect caste profile_assist relationship_status have_children move_abroad occupation highest_education smoke_status drink_status interests personality bio images address coordinates verification_status isActive user createdAt updatedAt';

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

// 1. BUILD AUTHENTICATED USER'S CANDIDATE PROFILE
const createCandidate = async (
  userId: string,
  payload: ICreateCandidatePayload
) => {
  const creatorRelation = mapLegacyRelationToLinkedRelation(
    payload.relationToUser ?? RelationToUser.SELF
  );

  const user = await User.findById(userId)
    .select('isVerified')
    .lean<{ isVerified?: boolean } | null>();

  if (!user) {
    throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
  }

  if (!user.isVerified) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Please verify your account before creating a candidate profile'
    );
  }

  // Each account can belong to only one active candidate profile.
  await ensureNoOtherActiveCandidateAccess({
    userId,
    message: 'This account is already linked to an active candidate profile',
    images: payload.images
  });

  let createdCandidateId: Types.ObjectId | null = null;

  // CREATE CANDIDATE PROFILE & LINKED USER ACCOUNT
  try {
    const normalizedImages = payload.images
      ? normalizeImageLinks(payload.images)
      : undefined;

    if (normalizedImages && normalizedImages.length > MAX_CANDIDATE_IMAGES) {
      // DELETE EXISTING IMAGE
      await deleteImageByBullMQ(payload.images ?? [], `delete_image_${Date.now()}_${userId}`);

      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Candidate profile can have a maximum of ${MAX_CANDIDATE_IMAGES} images`
      );
    }

    const createdCandidate = await Candidate.create(
      buildCandidateCreatePayload(userId, {
        ...payload,
        ...(normalizedImages ? { images: normalizedImages } : {}),
      })
    );
    createdCandidateId = createdCandidate._id;

    const ownerLink = await CandidateLinkedUser.create({
      accessRole: CandidateLinkedUserAccessRole.OWNER,
      candidate: createdCandidate._id,
      isPrimary: true,
      linkedBy: userId,
      name: payload.name.trim(),
      relationshipToCandidate: creatorRelation,
      status: CandidateLinkedUserStatus.ACTIVE,
      user: userId,
    });

    // Create the feed preference immediately so later swipe/feed reads are fast and predictable.
    await ensureDefaultCandidatePreference({
      candidateGender: createdCandidate.gender,
      candidateId: createdCandidate._id,
      createdBy: userId,
    });

    const candidateResponse = buildCandidateResponse(createdCandidate.toObject(), {
      userIsVerified: Boolean(user.isVerified),
    });

    return {
      ...candidateResponse,
      management: buildCandidateManagementSummary([
        {
          accessRole: ownerLink.accessRole,
          relationshipToCandidate: ownerLink.relationshipToCandidate,
          status: ownerLink.status,
        },
      ]),
      myAccess: {
        _id: ownerLink._id,
        accessRole: ownerLink.accessRole,
        relationshipToCandidate: ownerLink.relationshipToCandidate,
        status: ownerLink.status,
        isPrimary: ownerLink.isPrimary,
        linkedBy: ownerLink.linkedBy,
        joinedAt: ownerLink.joinedAt,
      },
    };
  } catch (error) {
    if (createdCandidateId) {
      // Keep the create flow atomic-ish without a transaction: remove records made in this request.
      await Promise.all([
        CandidateLinkedUser.deleteMany({ candidate: createdCandidateId }),
        deleteCandidatePreferenceByCandidateId(createdCandidateId),
        Candidate.deleteOne({ _id: createdCandidateId }),
      ]);
    }

    throw error;
  }
};

// 2. AUTHENTICATED LINKED USER UPDATE CANDIDATE PROFILE
const updateCandidate = async (
  userId: string,
  candidateId: string,
  payload: IUpdateCandidateRequestPayload,
  uploadedImages: string[] = []
) => {
  const { access } = await getActiveLinkedUserAccessOrThrow({
    candidateId,
    userId,
  });

  // VIEWER ACCESS IS READ-ONLY.
  if (access.accessRole === CandidateLinkedUserAccessRole.VIEWER) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Viewer access cannot update candidate profile'
    );
  }

  const existingCandidate = await Candidate.findById(candidateId)
    .select('_id user images interests personality')
    .lean<{
      _id: Types.ObjectId;
      user: Types.ObjectId;
      images?: string[];
      interests?: InterestKey[];
      personality?: PersonalityKey[];
    } | null>();

  if (!existingCandidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  const candidateOwner = await User.findById(existingCandidate.user)
    .select('isVerified')
    .lean<{ isVerified?: boolean } | null>();

  if (!candidateOwner) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate owner not found');
  }

  const {
    deletedInterests = [],
    deletedImages = [],
    deletedPersonality = [],
    interests: incomingInterests,
    personality: incomingPersonality,
    ...candidateFieldPayload
  } = payload;

  const updatePayload = buildCandidateUpdatePayload(
    candidateFieldPayload as IUpdateCandidatePayload
  );

  const existingImages = normalizeImageLinks(existingCandidate.images ?? []);
  const deleteTargets = normalizeImageLinks(deletedImages);
  const newImageLinks = normalizeImageLinks(uploadedImages);
  const deleteTargetSet = new Set(deleteTargets);
  const retainedImages = existingImages.filter((image) => !deleteTargetSet.has(image));
  const deletedImagesFromProfile = existingImages.filter((image) =>
    deleteTargetSet.has(image)
  );
  const retainedImageSet = new Set(retainedImages);
  const hasNewImages = newImageLinks.some((image) => !retainedImageSet.has(image));
  const hasImageChange = deletedImagesFromProfile.length > 0 || hasNewImages;

  if (hasImageChange) {
    const mergedImages = normalizeImageLinks([...retainedImages, ...newImageLinks]);

    if (mergedImages.length > MAX_CANDIDATE_IMAGES) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        `Candidate profile can have a maximum of ${MAX_CANDIDATE_IMAGES} images`
      );
    }

    updatePayload.images = mergedImages;
  }

  const existingInterests = normalizeArrayValues(existingCandidate.interests ?? []);
  const addedInterestKeys = normalizeArrayValues(incomingInterests ?? []);
  const deletedInterestSet = new Set(normalizeArrayValues(deletedInterests));
  const hasInterestsChange =
    addedInterestKeys.length > 0 ||
    deletedInterestSet.size > 0;

  if (hasInterestsChange) {
    const mergedInterests = normalizeArrayValues([
      ...existingInterests.filter((interest) => !deletedInterestSet.has(interest)),
      ...addedInterestKeys,
    ]);

    updatePayload.interests = mergedInterests;
  }

  const existingPersonality = normalizeArrayValues(
    existingCandidate.personality ?? []
  );
  const addedPersonalityKeys = normalizeArrayValues(incomingPersonality ?? []);
  const deletedPersonalitySet = new Set(normalizeArrayValues(deletedPersonality));
  const hasPersonalityChange =
    addedPersonalityKeys.length > 0 ||
    deletedPersonalitySet.size > 0;

  if (hasPersonalityChange) {
    const mergedPersonality = normalizeArrayValues([
      ...existingPersonality.filter((trait) => !deletedPersonalitySet.has(trait)),
      ...addedPersonalityKeys,
    ]);

    updatePayload.personality = mergedPersonality;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'At least one valid field or array change is required to update candidate profile'
    );
  }

  const updatedCandidate = await Candidate.findByIdAndUpdate(
    candidateId,
    { $set: updatePayload },
    {
      new: true,
      runValidators: true,
    }
  ).lean();

  if (!updatedCandidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  if (deletedImagesFromProfile.length > 0) {
    const deleteJobId = `delete_image_${Date.now()}_${candidateId}`;
    await deleteImageByBullMQ(deletedImagesFromProfile, deleteJobId);
  }

  return buildCandidateResponse(updatedCandidate, {
    userIsVerified: Boolean(candidateOwner.isVerified),
  });
};

// 3. PLAN-GATED FULL CANDIDATE PROFILE DETAILS
const getFullCandidateProfileDetails = async (
  userId: string,
  viewerCandidateId: string,
  targetCandidateId: string
) => {
  if (!viewerCandidateId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Candidate id is required');
  }

  if (!targetCandidateId) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Target candidate id is required');
  }

  if (!Types.ObjectId.isValid(viewerCandidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid candidate id');
  }

  if (!Types.ObjectId.isValid(targetCandidateId)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid target candidate id');
  }

  const viewerObjectId = new Types.ObjectId(viewerCandidateId);
  const targetObjectId = new Types.ObjectId(targetCandidateId);

  if (viewerObjectId.equals(targetObjectId)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'You cannot view your own candidate profile from this endpoint'
    );
  }

  const [
    linkedAccess,
    legacyOwnerAccess,
    viewerCandidate,
    targetCandidate,
    reportBetweenCandidates,
    marriedProgress,
  ] = await Promise.all([
    CandidateLinkedUser.exists({
      candidate: viewerObjectId,
      status: CandidateLinkedUserStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    }),
    Candidate.exists({
      _id: viewerObjectId,
      isActive: ActiveStatus.ACTIVE,
      user: new Types.ObjectId(userId),
    }),
    Candidate.findById(viewerObjectId)
      .select('_id plan isActive')
      .lean<{ _id: Types.ObjectId; plan?: PlanKey; isActive?: ActiveStatus } | null>(),
    Candidate.findOne({
      _id: targetObjectId,
      isActive: ActiveStatus.ACTIVE,
    })
      .select(FULL_PROFILE_CANDIDATE_SELECT)
      .populate({
        match: {
          isActive: ActiveStatus.ACTIVE,
          isDeleted: false,
          isVerified: true,
        },
        path: 'user',
        select: '_id isActive isDeleted isVerified',
      })
      .lean<TFullProfileCandidateLean | null>(),
    Report.exists({
      $or: [
        {
          reportedBy: viewerObjectId,
          reportedCandidate: targetObjectId,
        },
        {
          reportedBy: targetObjectId,
          reportedCandidate: viewerObjectId,
        },
      ],
    }),
    RishtaProgress.exists({
      candidates: { $in: [viewerObjectId, targetObjectId] },
      status: RishtaProgressStatus.MARRIED,
    }),
  ]);

  if (!viewerCandidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
  }

  if (viewerCandidate.isActive !== ActiveStatus.ACTIVE) {
    throw new AppError(StatusCodes.FORBIDDEN, 'Candidate profile is not active');
  }

  if (!linkedAccess && !legacyOwnerAccess) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'You do not have access to manage this candidate profile'
    );
  }

  const planKey = PLAN_KEYS.includes(viewerCandidate.plan as PlanKey)
    ? (viewerCandidate.plan as PlanKey)
    : 'free';
  const planDocument = await PlanModel.findOne({
    isActive: true,
    key: planKey,
  })
    .select('canViewFullProfile')
    .lean<Pick<IPlan, 'canViewFullProfile'> | null>();
  const currentPlan = {
    ...PLANS[planKey],
    ...(planDocument ?? {}),
  };

  if (!currentPlan.canViewFullProfile) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Need gold plan access to view full candidate profile details'
    );
  }

  if (!targetCandidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Target candidate profile not found');
  }

  const targetOwner =
    targetCandidate.user &&
    typeof targetCandidate.user === 'object' &&
    'isVerified' in targetCandidate.user
      ? targetCandidate.user
      : null;

  if (!targetOwner) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Target candidate profile is not available'
    );
  }

  if (reportBetweenCandidates) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Profile details are blocked because a report exists between these candidates'
    );
  }

  if (marriedProgress) {
    throw new AppError(
      StatusCodes.CONFLICT,
      'Married candidates are not available for full profile details'
    );
  }

  const age = Math.floor(
    (Date.now() - targetCandidate.dateOfBirth.getTime()) / MS_PER_YEAR
  );

  return {
    _id: targetCandidate._id,
    name: targetCandidate.name,
    age,
    dateOfBirth: targetCandidate.dateOfBirth,
    gender: targetCandidate.gender,
    height: targetCandidate.height,
    religion: targetCandidate.religion,
    sect: targetCandidate.sect,
    caste: targetCandidate.caste,
    profile_assist: targetCandidate.profile_assist,
    relationship_status: targetCandidate.relationship_status,
    have_children: targetCandidate.have_children,
    move_abroad: targetCandidate.move_abroad,
    occupation: targetCandidate.occupation,
    highest_education: targetCandidate.highest_education,
    smoke_status: targetCandidate.smoke_status,
    drink_status: targetCandidate.drink_status,
    interests: targetCandidate.interests ?? [],
    personality: targetCandidate.personality ?? [],
    bio: targetCandidate.bio,
    images: targetCandidate.images ?? [],
    address: targetCandidate.address,
    coordinates: targetCandidate.coordinates,
    verification_status: targetCandidate.verification_status,
    badge: hasVerificationBadge({
      userIsVerified: Boolean(targetOwner.isVerified),
      verificationStatus: targetCandidate.verification_status,
    }),
    labels: buildCandidateLabels(targetCandidate),
    createdAt: targetCandidate.createdAt,
    updatedAt: targetCandidate.updatedAt,
  };
};

export const CandidateService = {
  createCandidate,
  getFullCandidateProfileDetails,
  updateCandidate,
};
