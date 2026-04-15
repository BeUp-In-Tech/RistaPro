import { Types } from 'mongoose';
import Candidate from './candidate.model';
import {
  ICreateCandidatePayload,
  RelationToUser,
} from './candidate.interface';
import { buildCandidateCreatePayload, buildCandidateResponse } from './candidate.utility';
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

    const createdCandidate = await Candidate.create(
      buildCandidateCreatePayload(userId, payload)
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

export const CandidateService = {
  createCandidate,
};
