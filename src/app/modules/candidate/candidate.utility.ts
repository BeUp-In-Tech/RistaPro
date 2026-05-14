import { CASTS, CHILDREN, DRINK_STATUSES, HIGHEST_EDUCATION, INTERESTS, MOVE_ABROAD, OCCUPATIONS, PERSONALITY_TRAITS, RELATIONSHIP_STATUSES, RELIGIONS, SECTS, SMOKE_STATUSES } from '../../constant/constant';
import { ICandidateProfileFields, ICreateCandidatePayload, IUpdateCandidatePayload } from './candidate.interface';

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

export const buildCandidateLabels = (candidate: Partial<ICandidateProfileFields>) => ({
  religion: getLabel(candidate.religion, RELIGIONS),
  sect: candidate.religion && candidate.sect ? getLabel(candidate.sect, SECTS[candidate.religion as keyof typeof SECTS] || {}) : undefined,
  caste: getLabel(candidate.caste, CASTS),
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

/**
 * Add labels to candidate response
 */
export const buildCandidateResponse = <T extends Partial<ICandidateProfileFields>>(candidate: T) => ({
  ...candidate,
  labels: buildCandidateLabels(candidate),
});

/**
 * Build clean DB payload from create request - filters undefined values
 */
export const buildCandidateCreatePayload = (userId: string, payload: ICreateCandidatePayload) => ({
  user: userId,
  name: payload.name?.trim(),
  dateOfBirth: payload.dateOfBirth,
  gender: payload.gender,
  ...(payload.height !== undefined && { height: payload.height }),
  ...(payload.religion !== undefined && { religion: payload.religion }),
  ...(payload.sect !== undefined && { sect: payload.sect }),
  ...(payload.caste !== undefined && { caste: payload.caste }),
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
  ...(payload.religion !== undefined && { religion: payload.religion }),
  ...(payload.sect !== undefined && { sect: payload.sect }),
  ...(payload.caste !== undefined && { caste: payload.caste }),
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

