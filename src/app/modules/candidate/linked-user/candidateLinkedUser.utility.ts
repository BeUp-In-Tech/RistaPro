import { Types } from 'mongoose';
import { ActiveStatus, Role } from '../../user/user.interface';
import { RelationToUser } from '../candidate.interface';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserRelation,
  CandidateLinkedUserStatus,
  CandidateManagementMode,
  ICandidateLinkedUser,
  ICandidateManagementSummary,
} from './candidateLinkedUser.interface';

type TLinkedUserSummaryInput = Pick<
  ICandidateLinkedUser,
  'relationshipToCandidate' | 'accessRole' | 'status'
>;

export interface TLinkedUserSafeUser  {
  _id: Types.ObjectId | string;
  full_name: string;
  email: string;
  picture?: string;
  role: Role;
  isVerified?: boolean;
  isActive?: ActiveStatus;
};

export interface TLinkedUserResponseInput  {
  _id: Types.ObjectId | string;
  accessRole: CandidateLinkedUserAccessRole;
  relationshipToCandidate: CandidateLinkedUserRelation;
  status: CandidateLinkedUserStatus;
  isPrimary: boolean;
  linkedBy: Types.ObjectId | string;
  joinedAt?: Date;
  removedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  user?: TLinkedUserSafeUser | null;
};

export const CANDIDATE_LINKED_USER_RELATION_LABELS: Record<
  CandidateLinkedUserRelation,
  string
> = {
  [CandidateLinkedUserRelation.SELF]: 'Self',
  [CandidateLinkedUserRelation.FATHER]: 'Father',
  [CandidateLinkedUserRelation.MOTHER]: 'Mother',
  [CandidateLinkedUserRelation.BROTHER]: 'Brother',
  [CandidateLinkedUserRelation.SISTER]: 'Sister',
  [CandidateLinkedUserRelation.GUARDIAN]: 'Guardian',
  [CandidateLinkedUserRelation.RELATIVE]: 'Relative',
  [CandidateLinkedUserRelation.CONSULTANT]: 'Consultant',
  [CandidateLinkedUserRelation.OTHER]: 'Other',
};

export const CANDIDATE_LINKED_USER_ACCESS_ROLE_LABELS: Record<
  CandidateLinkedUserAccessRole,
  string
> = {
  [CandidateLinkedUserAccessRole.OWNER]: 'Owner',
  [CandidateLinkedUserAccessRole.EDITOR]: 'Editor',
  [CandidateLinkedUserAccessRole.VIEWER]: 'Viewer',
};

export const CANDIDATE_CREATOR_RELATION_LABELS: Record<
  Exclude<RelationToUser, RelationToUser.OTHERS>,
  string
> = {
  [RelationToUser.SELF]: 'Self',
  [RelationToUser.FATHER]: 'Father',
  [RelationToUser.MOTHER]: 'Mother',
  [RelationToUser.BROTHER]: 'Brother',
  [RelationToUser.SISTER]: 'Sister',
  [RelationToUser.GUARDIAN]: 'Guardian',
  [RelationToUser.RELATIVE]: 'Relative',
  [RelationToUser.CONSULTANT]: 'Consultant',
  [RelationToUser.OTHER]: 'Other',
};

export const mapLegacyRelationToLinkedRelation = (
  relation?: RelationToUser
): CandidateLinkedUserRelation => {
  switch (relation) {
    case RelationToUser.FATHER:
      return CandidateLinkedUserRelation.FATHER;
    case RelationToUser.MOTHER:
      return CandidateLinkedUserRelation.MOTHER;
    case RelationToUser.BROTHER:
      return CandidateLinkedUserRelation.BROTHER;
    case RelationToUser.SISTER:
      return CandidateLinkedUserRelation.SISTER;
    case RelationToUser.GUARDIAN:
      return CandidateLinkedUserRelation.GUARDIAN;
    case RelationToUser.RELATIVE:
      return CandidateLinkedUserRelation.RELATIVE;
    case RelationToUser.CONSULTANT:
      return CandidateLinkedUserRelation.CONSULTANT;
    case RelationToUser.OTHER:
    case RelationToUser.OTHERS:
      return CandidateLinkedUserRelation.OTHER;
    case RelationToUser.SELF:
    default:
      return CandidateLinkedUserRelation.SELF;
  }
};

export const getDefaultLinkedUserAccessRole = (
  relation: CandidateLinkedUserRelation
) =>
  relation === CandidateLinkedUserRelation.SELF
    ? CandidateLinkedUserAccessRole.OWNER
    : CandidateLinkedUserAccessRole.EDITOR;

export const isOwnerLinkedUser = (
  accessRole: CandidateLinkedUserAccessRole
) => accessRole === CandidateLinkedUserAccessRole.OWNER;

export const buildCandidateManagementSummary = (
  linkedUsers: TLinkedUserSummaryInput[]
): ICandidateManagementSummary => {
  const activeLinkedUsers = linkedUsers.filter(
    (linkedUser) => linkedUser.status === CandidateLinkedUserStatus.ACTIVE
  );

  const activeRelations = new Set(
    activeLinkedUsers.map((linkedUser) => linkedUser.relationshipToCandidate)
  );

  const hasSelfManager = activeRelations.has(CandidateLinkedUserRelation.SELF);
  const hasParentManager =
    activeRelations.has(CandidateLinkedUserRelation.FATHER) ||
    activeRelations.has(CandidateLinkedUserRelation.MOTHER);
  const hasConsultantManager = activeRelations.has(
    CandidateLinkedUserRelation.CONSULTANT
  );
  const hasFamilyManager =
    activeRelations.has(CandidateLinkedUserRelation.BROTHER) ||
    activeRelations.has(CandidateLinkedUserRelation.SISTER) ||
    activeRelations.has(CandidateLinkedUserRelation.GUARDIAN) ||
    activeRelations.has(CandidateLinkedUserRelation.RELATIVE) ||
    activeRelations.has(CandidateLinkedUserRelation.OTHER);

  let mode = CandidateManagementMode.MIXED_ASSISTED;

  if (activeLinkedUsers.length <= 1 && hasSelfManager) {
    mode = CandidateManagementMode.SELF_MANAGED;
  } else if (hasConsultantManager && (hasParentManager || hasFamilyManager)) {
    mode = CandidateManagementMode.MIXED_ASSISTED;
  } else if (hasConsultantManager && hasSelfManager) {
    mode = CandidateManagementMode.MIXED_ASSISTED;
  } else if (hasConsultantManager) {
    mode = CandidateManagementMode.CONSULTANT_ASSISTED;
  } else if (hasParentManager) {
    mode = CandidateManagementMode.PARENT_ASSISTED;
  } else if (hasFamilyManager) {
    mode = CandidateManagementMode.FAMILY_ASSISTED;
  } else if (hasSelfManager) {
    mode = CandidateManagementMode.SELF_MANAGED;
  }

  return {
    mode,
    activeLinkedUserCount: activeLinkedUsers.length,
    ownerCount: activeLinkedUsers.filter((linkedUser) =>
      isOwnerLinkedUser(linkedUser.accessRole)
    ).length,
    hasSelfManager,
    hasParentManager,
    hasConsultantManager,
  };
};

export const buildCandidateLinkedUserResponse = (
  linkedUser: TLinkedUserResponseInput
) => ({
  _id: linkedUser._id,
  accessRole: linkedUser.accessRole,
  accessRoleLabel: CANDIDATE_LINKED_USER_ACCESS_ROLE_LABELS[linkedUser.accessRole],
  relationshipToCandidate: linkedUser.relationshipToCandidate,
  relationshipToCandidateLabel:
    CANDIDATE_LINKED_USER_RELATION_LABELS[linkedUser.relationshipToCandidate],
  status: linkedUser.status,
  isPrimary: linkedUser.isPrimary,
  linkedBy: linkedUser.linkedBy,
  joinedAt: linkedUser.joinedAt,
  removedAt: linkedUser.removedAt,
  createdAt: linkedUser.createdAt,
  updatedAt: linkedUser.updatedAt,
  user: linkedUser.user
    ? {
        _id: linkedUser.user._id,
        full_name: linkedUser.user.full_name,
        email: linkedUser.user.email,
        picture: linkedUser.user.picture,
        role: linkedUser.user.role,
        isVerified: linkedUser.user.isVerified,
        isActive: linkedUser.user.isActive,
      }
    : null,
});
