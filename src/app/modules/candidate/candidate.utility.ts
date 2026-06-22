import { CASTE_CATEGORIES, CASTE_CLANS, CASTE_TREE_CASTES, CHILDREN, DRINK_STATUSES, HIGHEST_EDUCATION, INTERESTS, MADHHABS, MOVE_ABROAD, OCCUPATIONS, PERSONALITY_TRAITS, RELATIONSHIP_STATUSES, RELIGION_TREE_MADHHABS, RELIGION_TREE_MOVEMENTS, RELIGION_TREE_RELIGIONS, RELIGION_TREE_SECTS, RELIGIONS, SECT_DETAIL_VALUES, SECTS, SMOKE_STATUSES, SUFI_ORDERS, THEOLOGICAL_ORIENTATIONS } from '../../constant/constant';
import {
  ICandidateCasteIdentityFields,
  ICandidateProfileFields,
  ICandidateReligiousFields,
  ICreateCandidatePayload,
  IUpdateCandidatePayload,
  IVerificationStatus,
  VerificationState,
} from './candidate.interface';

export const MAX_CANDIDATE_IMAGES = 6;

/**
 * Utility: Remove duplicates from array
 */
export const getUniqueValues = <T extends string>(values?: T[]) => (values ? Array.from(new Set(values)) : undefined);

/**
 * Utility: Normalize and clean image URLs or text values
 */
export const normalizeImageLinks = (images: string[]) => Array.from(new Set(images.map((image) => image.trim()).filter((image) => image.length)));

export const normalizeArrayValues = <T extends string>(values: T[]) =>
  Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length))
  ) as T[];

/**
 * Transform candidate enum keys to user-facing labels
 */
const getLabel = (value: string | undefined, mapping: Record<string, string>) => (value && mapping[value] ? mapping[value] : undefined);

export const getCandidateReligiousFields = (
  candidate: Partial<ICandidateProfileFields>
): ICandidateReligiousFields => ({
  religion: candidate.religious?.religion ?? candidate.religion,
  sect: candidate.religious?.sect ?? candidate.sect,
  sectDetail: candidate.religious?.sectDetail ?? candidate.sectDetail,
  madhhab: candidate.religious?.madhhab ?? candidate.madhhab,
  movement: candidate.religious?.movement ?? candidate.movement,
  theologicalOrientation:
    candidate.religious?.theologicalOrientation ??
    candidate.theologicalOrientation,
  sufiOrder: candidate.religious?.sufiOrder ?? candidate.sufiOrder,
});

export const getCandidateCasteIdentityFields = (
  candidate: Partial<ICandidateProfileFields>
): ICandidateCasteIdentityFields => ({
  category: candidate.casteIdentity?.category,
  caste: candidate.casteIdentity?.caste,
  clan: candidate.casteIdentity?.clan,
});

export const buildCandidateLabels = (candidate: Partial<ICandidateProfileFields>) => ({
  religious: {
    religion: getLabel(getCandidateReligiousFields(candidate).religion, RELIGIONS) ?? getLabel(getCandidateReligiousFields(candidate).religion, RELIGION_TREE_RELIGIONS),
    sect: getCandidateReligiousFields(candidate).religion && getCandidateReligiousFields(candidate).sect ? getLabel(getCandidateReligiousFields(candidate).sect, SECTS[getCandidateReligiousFields(candidate).religion as keyof typeof SECTS] || {}) ?? getLabel(getCandidateReligiousFields(candidate).sect, RELIGION_TREE_SECTS) : undefined,
    sectDetail: getLabel(getCandidateReligiousFields(candidate).sectDetail, SECT_DETAIL_VALUES),
    madhhab: getLabel(getCandidateReligiousFields(candidate).madhhab, MADHHABS) ?? getLabel(getCandidateReligiousFields(candidate).madhhab, RELIGION_TREE_MADHHABS),
    movement: getLabel(getCandidateReligiousFields(candidate).movement, RELIGION_TREE_MOVEMENTS),
    theologicalOrientation: getLabel(getCandidateReligiousFields(candidate).theologicalOrientation, THEOLOGICAL_ORIENTATIONS),
    sufiOrder: getLabel(getCandidateReligiousFields(candidate).sufiOrder, SUFI_ORDERS),
  },
  casteIdentity: {
    category: getLabel(getCandidateCasteIdentityFields(candidate).category, CASTE_CATEGORIES),
    caste: getLabel(getCandidateCasteIdentityFields(candidate).caste, CASTE_TREE_CASTES),
    clan: getLabel(getCandidateCasteIdentityFields(candidate).clan, CASTE_CLANS),
  },
  relationship_status: getLabel(candidate.relationship_status, RELATIONSHIP_STATUSES),
  have_children: getLabel(candidate.have_children, CHILDREN),
  move_abroad: getLabel(candidate.move_abroad, MOVE_ABROAD),
  occupation: getLabel(candidate.occupation, OCCUPATIONS),
  highest_education: getLabel(candidate.highest_education, HIGHEST_EDUCATION),
  smoke_status: getLabel(candidate.smoke_status, SMOKE_STATUSES),
  drink_status: getLabel(candidate.drink_status, DRINK_STATUSES),
  interests: candidate.interests?.map((v) => INTERESTS[v as keyof typeof INTERESTS]).filter(Boolean),
  personality: candidate.personality?.map((v) => PERSONALITY_TRAITS[v as keyof typeof PERSONALITY_TRAITS]).filter(Boolean),
});

const isApproved = (status?: { status?: VerificationState }) =>
  status?.status === VerificationState.APPROVED;

// Badge is true only when profile is verified and all required verification steps are approved.
export const hasVerificationBadge = (params: {
  userIsVerified: boolean;
  verificationStatus?: IVerificationStatus;
}) => {
  const { userIsVerified, verificationStatus } = params;
  if (!userIsVerified || !verificationStatus) {
    return false;
  }

  return (
    isApproved(verificationStatus.face_verified) &&
    isApproved(verificationStatus.id_verified) &&
    isApproved(verificationStatus.education_verified) &&
    isApproved(verificationStatus.parent_verified)
  );
};

/**
 * Add labels to candidate response
 */
export const buildCandidateResponse = <
  T extends Partial<ICandidateProfileFields> & {
    verification_status?: IVerificationStatus;
  },
>(
  candidate: T,
  options: { userIsVerified: boolean }
) => ({
  ...candidate,
  religious: getCandidateReligiousFields(candidate),
  casteIdentity: getCandidateCasteIdentityFields(candidate),
  badge: hasVerificationBadge({
    userIsVerified: options.userIsVerified,
    verificationStatus: candidate.verification_status,
  }),
  labels: buildCandidateLabels(candidate),
});

/**
 * Build clean DB payload from create request - filters undefined values
 */
export const buildCandidateCreatePayload = (userId: string, payload: ICreateCandidatePayload) => ({
  ...(() => {
    const religious = getCandidateReligiousFields(payload);
    const casteIdentity = getCandidateCasteIdentityFields(payload);

    return {
      ...(Object.values(religious).some((value) => value !== undefined) && { religious }),
      ...(Object.values(casteIdentity).some((value) => value !== undefined) && { casteIdentity }),
    };
  })(),
  user: userId,
  name: payload.name?.trim(),
  dateOfBirth: payload.dateOfBirth,
  gender: payload.gender,
  ...(payload.height !== undefined && { height: payload.height }),
  ...(payload.profile_assist !== undefined && { profile_assist: payload.profile_assist.trim() }),
  ...(payload.relationship_status !== undefined && { relationship_status: payload.relationship_status }),
  ...(payload.have_children !== undefined && { have_children: payload.have_children }),
  ...(payload.move_abroad !== undefined && { move_abroad: payload.move_abroad }),
  ...(payload.occupation !== undefined && { occupation: payload.occupation }),
  ...(payload.highest_education !== undefined && { highest_education: payload.highest_education }),
  ...(payload.smoke_status !== undefined && { smoke_status: payload.smoke_status }),
  ...(payload.drink_status !== undefined && { drink_status: payload.drink_status }),
  ...(payload.interests !== undefined && { interests: getUniqueValues(payload.interests) }),
  ...(payload.personality !== undefined && { personality: getUniqueValues(payload.personality) }),
  ...(payload.relationToUser !== undefined && { relationToUser: payload.relationToUser.trim() }),
  ...(payload.bio !== undefined && { bio: payload.bio.trim() }),
  ...(payload.images !== undefined && { images: getUniqueValues(payload.images.map((v) => v.trim())) }),
  ...(payload.address !== undefined && { address: payload.address.trim() }),
  ...(payload.coordinates !== undefined && { coordinates: payload.coordinates }),
});

/**
 * Build clean DB payload for update - only includes provided fields
 */
export const buildCandidateUpdatePayload = (payload: IUpdateCandidatePayload) => ({
  ...(payload.name !== undefined && { name: payload.name.trim() }),
  ...(payload.dateOfBirth !== undefined && { dateOfBirth: payload.dateOfBirth }),
  ...(payload.gender !== undefined && { gender: payload.gender }),
  ...(payload.height !== undefined && { height: payload.height }),
  ...(payload.religious?.religion !== undefined && { 'religious.religion': payload.religious.religion }),
  ...(payload.religious?.sect !== undefined && { 'religious.sect': payload.religious.sect }),
  ...(payload.religious?.sectDetail !== undefined && { 'religious.sectDetail': payload.religious.sectDetail }),
  ...(payload.religious?.madhhab !== undefined && { 'religious.madhhab': payload.religious.madhhab }),
  ...(payload.religious?.movement !== undefined && { 'religious.movement': payload.religious.movement }),
  ...(payload.religious?.theologicalOrientation !== undefined && { 'religious.theologicalOrientation': payload.religious.theologicalOrientation }),
  ...(payload.religious?.sufiOrder !== undefined && { 'religious.sufiOrder': payload.religious.sufiOrder }),
  ...(payload.religion !== undefined && { 'religious.religion': payload.religion }),
  ...(payload.sect !== undefined && { 'religious.sect': payload.sect }),
  ...(payload.sectDetail !== undefined && { 'religious.sectDetail': payload.sectDetail }),
  ...(payload.madhhab !== undefined && { 'religious.madhhab': payload.madhhab }),
  ...(payload.movement !== undefined && { 'religious.movement': payload.movement }),
  ...(payload.theologicalOrientation !== undefined && { 'religious.theologicalOrientation': payload.theologicalOrientation }),
  ...(payload.sufiOrder !== undefined && { 'religious.sufiOrder': payload.sufiOrder }),
  ...(payload.casteIdentity?.category !== undefined && { 'casteIdentity.category': payload.casteIdentity.category }),
  ...(payload.casteIdentity?.caste !== undefined && { 'casteIdentity.caste': payload.casteIdentity.caste }),
  ...(payload.casteIdentity?.clan !== undefined && { 'casteIdentity.clan': payload.casteIdentity.clan }),
  ...(payload.profile_assist !== undefined && { profile_assist: payload.profile_assist.trim() }),
  ...(payload.relationship_status !== undefined && { relationship_status: payload.relationship_status }),
  ...(payload.have_children !== undefined && { have_children: payload.have_children }),
  ...(payload.move_abroad !== undefined && { move_abroad: payload.move_abroad }),
  ...(payload.occupation !== undefined && { occupation: payload.occupation }),
  ...(payload.highest_education !== undefined && { highest_education: payload.highest_education }),
  ...(payload.smoke_status !== undefined && { smoke_status: payload.smoke_status }),
  ...(payload.drink_status !== undefined && { drink_status: payload.drink_status }),
  ...(payload.interests !== undefined && { interests: getUniqueValues(payload.interests) }),
  ...(payload.personality !== undefined && { personality: getUniqueValues(payload.personality) }),
  ...(payload.relationToUser !== undefined && { relationToUser: payload.relationToUser.trim() }),
  ...(payload.bio !== undefined && { bio: payload.bio.trim() }),
  ...(payload.images !== undefined && { images: getUniqueValues(payload.images.map((v) => v.trim())) }),
  ...(payload.address !== undefined && { address: payload.address.trim() }),
  ...(payload.coordinates !== undefined && { coordinates: payload.coordinates }),
});

