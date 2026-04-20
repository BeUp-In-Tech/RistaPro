import {
  CASTS,
  CHILDREN,
  DRINK_STATUSES,
  HIGHEST_EDUCATION,
  INTERESTS,
  MOVE_ABROAD,
  OCCUPATIONS,
  PERSONALITY_TRAITS,
  RELATIONSHIP_STATUSES,
  RELIGIONS,
  SECTS,
  SMOKE_STATUSES,
} from "../../constant/constant";
import {
  ICandidateProfileFields,
  ICreateCandidatePayload,
  IUpdateCandidatePayload,
} from "./candidate.interface";

export const getUniqueValues = <T extends string>(values?: T[]) =>
  values ? Array.from(new Set(values)) : undefined;

// Keep DB values stable as keys and derive user-facing labels only in responses.
export const buildCandidateLabels = (candidate: Partial<ICandidateProfileFields>) => ({
  religion: candidate.religion
    ? RELIGIONS[candidate.religion]
    : undefined,
  sect:
    candidate.religion && candidate.sect
      ? SECTS[candidate.religion][candidate.sect]
      : undefined,
  caste: candidate.caste ? CASTS[candidate.caste] : undefined,
  relationship_status: candidate.relationship_status
    ? RELATIONSHIP_STATUSES[candidate.relationship_status]
    : undefined,
  have_children: candidate.have_children
    ? CHILDREN[candidate.have_children]
    : undefined,
  move_abroad: candidate.move_abroad
    ? MOVE_ABROAD[candidate.move_abroad]
    : undefined,
  occupation: candidate.occupation
    ? OCCUPATIONS[candidate.occupation]
    : undefined,
  highest_education: candidate.highest_education
    ? HIGHEST_EDUCATION[candidate.highest_education]
    : undefined,
  smoke_status: candidate.smoke_status
    ? SMOKE_STATUSES[candidate.smoke_status]
    : undefined,
  drink_status: candidate.drink_status
    ? DRINK_STATUSES[candidate.drink_status]
    : undefined,
  interests: candidate.interests?.map((value) => INTERESTS[value]).filter(Boolean),
  personality: candidate.personality?.map(
    (value) => PERSONALITY_TRAITS[value]
  ).filter(Boolean),});

export const buildCandidateResponse = <T extends Partial<ICandidateProfileFields>>(
  candidate: T
) => ({
  ...candidate,
  labels: buildCandidateLabels(candidate),
});

// Build a clean database payload from validated request data.
export const buildCandidateCreatePayload = (
  userId: string,
  payload: ICreateCandidatePayload
) => {
  const candidatePayload: Record<string, unknown> = {
    user: userId,
    name: payload.name.trim(),
    dateOfBirth: payload.dateOfBirth,
    gender: payload.gender,
  };

  if (payload.height !== undefined) {
    candidatePayload.height = payload.height;
  }

  if (payload.religion !== undefined) {
    candidatePayload.religion = payload.religion;

    if (payload.sect !== undefined) {
      candidatePayload.sect = payload.sect;
    }
  }

  if (payload.caste !== undefined) {
    candidatePayload.caste = payload.caste;
  }

  if (payload.profile_assist !== undefined) {
    candidatePayload.profile_assist = payload.profile_assist.trim();
  }

  if (payload.relationship_status !== undefined) {
    candidatePayload.relationship_status = payload.relationship_status;
  }

  if (payload.have_children !== undefined) {
    candidatePayload.have_children = payload.have_children;
  }

  if (payload.move_abroad !== undefined) {
    candidatePayload.move_abroad = payload.move_abroad;
  }

  if (payload.occupation !== undefined) {
    candidatePayload.occupation = payload.occupation;
  }

  if (payload.highest_education !== undefined) {
    candidatePayload.highest_education = payload.highest_education;
  }

  if (payload.smoke_status !== undefined) {
    candidatePayload.smoke_status = payload.smoke_status;
  }

  if (payload.drink_status !== undefined) {
    candidatePayload.drink_status = payload.drink_status;
  }

  if (payload.interests !== undefined) {
    candidatePayload.interests = getUniqueValues(payload.interests);
  }

  if (payload.personality !== undefined) {
    candidatePayload.personality = getUniqueValues(payload.personality);
  }

  if (payload.relationToUser !== undefined) {
    candidatePayload.relationToUser = payload.relationToUser.trim();
  }

  if (payload.partnerExpectation !== undefined) {
    candidatePayload.partnerExpectation = payload.partnerExpectation.trim();
  }

  if (payload.bio !== undefined) {
    candidatePayload.bio = payload.bio.trim();
  }

  if (payload.images !== undefined) {
    candidatePayload.images = getUniqueValues(
      payload.images.map((value) => value.trim())
    );
  }

  if (payload.address !== undefined) {
    candidatePayload.address = payload.address.trim();
  }

  if (payload.coordinates !== undefined) {
    candidatePayload.coordinates = [...payload.coordinates];
  }

  return candidatePayload;
};

// Build a clean update payload from validated candidate update data.
export const buildCandidateUpdatePayload = (
  payload: IUpdateCandidatePayload
) => {
  const updatePayload: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    updatePayload.name = payload.name.trim();
  }

  if (payload.dateOfBirth !== undefined) {
    updatePayload.dateOfBirth = payload.dateOfBirth;
  }

  if (payload.gender !== undefined) {
    updatePayload.gender = payload.gender;
  }

  if (payload.height !== undefined) {
    updatePayload.height = payload.height;
  }

  if (payload.religion !== undefined) {
    updatePayload.religion = payload.religion;
  }

  if (payload.sect !== undefined) {
    updatePayload.sect = payload.sect;
  }

  if (payload.caste !== undefined) {
    updatePayload.caste = payload.caste;
  }

  if (payload.profile_assist !== undefined) {
    updatePayload.profile_assist = payload.profile_assist.trim();
  }

  if (payload.relationship_status !== undefined) {
    updatePayload.relationship_status = payload.relationship_status;
  }

  if (payload.have_children !== undefined) {
    updatePayload.have_children = payload.have_children;
  }

  if (payload.move_abroad !== undefined) {
    updatePayload.move_abroad = payload.move_abroad;
  }

  if (payload.occupation !== undefined) {
    updatePayload.occupation = payload.occupation;
  }

  if (payload.highest_education !== undefined) {
    updatePayload.highest_education = payload.highest_education;
  }

  if (payload.smoke_status !== undefined) {
    updatePayload.smoke_status = payload.smoke_status;
  }

  if (payload.drink_status !== undefined) {
    updatePayload.drink_status = payload.drink_status;
  }

  if (payload.interests !== undefined) {
    updatePayload.interests = getUniqueValues(payload.interests);
  }

  if (payload.personality !== undefined) {
    updatePayload.personality = getUniqueValues(payload.personality);
  }

  if (payload.relationToUser !== undefined) {
    updatePayload.relationToUser = payload.relationToUser.trim();
  }

  if (payload.partnerExpectation !== undefined) {
    updatePayload.partnerExpectation = payload.partnerExpectation.trim();
  }

  if (payload.bio !== undefined) {
    updatePayload.bio = payload.bio.trim();
  }

  if (payload.images !== undefined) {
    updatePayload.images = getUniqueValues(
      payload.images.map((value) => value.trim())
    );
  }

  if (payload.address !== undefined) {
    updatePayload.address = payload.address.trim();
  }

  if (payload.coordinates !== undefined) {
    updatePayload.coordinates = [...payload.coordinates];
  }

  return updatePayload;
};

export const MAX_CANDIDATE_IMAGES = 6;
export const normalizeImageLinks = (images: string[]) =>
  Array.from(
    new Set(images.map((image) => image.trim()).filter((image) => image.length))
  );
export const normalizeArrayValues = (values: string[]) =>
  Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length))
  );
