import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errorHelpers/AppError';
import { deleteImageByBullMQ } from '../../utils/backgroundJobProcessingHelper';
import Candidate from './candidate.model';
import {
  ICreateCandidatePayload,
  IUpdateCandidatePayload,
  IUpdateCandidateRequestPayload,
  RelationToUser,
} from './candidate.interface';
import {
  buildCandidateCreatePayload,
  buildCandidateResponse,
  buildCandidateUpdatePayload,
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


// 1. BUILD AUTHENTICATED USER'S CANDIDATE PROFILE
const createCandidate = async (
  userId: string,
  payload: ICreateCandidatePayload
) => {
  const creatorRelation = mapLegacyRelationToLinkedRelation(
    payload.relationToUser ?? RelationToUser.SELF
  );

  // Each account can belong to only one active candidate profile.
  await ensureNoOtherActiveCandidateAccess({
    userId,
    message: 'This account is already linked to an active candidate profile',
  });

  let createdCandidateId: Types.ObjectId | null = null;

  // CREATE CANDIDATE PROFILE & LINKED USER ACCOUNT
  try {
    const normalizedImages = payload.images
      ? normalizeImageLinks(payload.images)
      : undefined;

    if (normalizedImages && normalizedImages.length > MAX_CANDIDATE_IMAGES) {
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

    const candidateResponse = buildCandidateResponse(createdCandidate.toObject());

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
      await Candidate.deleteOne({ _id: createdCandidateId });
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
    .select('_id images interests personality')
    .lean<{
      _id: Types.ObjectId;
      images?: string[];
      interests?: string[];
      personality?: string[];
    } | null>();

  if (!existingCandidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate profile not found');
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

  return buildCandidateResponse(updatedCandidate);
};

export const CandidateService = {
  createCandidate,
  updateCandidate,
};
