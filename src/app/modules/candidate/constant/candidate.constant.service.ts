import {
  CASTE_TREE,
  CHILDREN,
  DRINK_STATUSES,
  HIGHEST_EDUCATION,
  INTERESTS,
  INTERESTS_BY_CATEGORY,
  INTEREST_CATEGORIES,
  MADHHABS,
  MOVE_ABROAD,
  OCCUPATIONS,
  PERSONALITY_TRAITS,
  RELATIONSHIP_STATUSES,
  RELIGIONS,
  RELIGION_TREE,
  SECTS,
  SECT_DETAILS,
  SMOKE_STATUSES,
  SUFI_ORDERS,
  THEOLOGICAL_ORIENTATIONS,
} from '../../../constant/constant';
import { RelationToUser } from '../candidate.interface';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserRelation,
} from '../linked-user/candidateLinkedUser.interface';
import {
  CANDIDATE_CREATOR_RELATION_LABELS,
  CANDIDATE_LINKED_USER_ACCESS_ROLE_LABELS,
  CANDIDATE_LINKED_USER_RELATION_LABELS,
} from '../linked-user/candidateLinkedUser.utility';

interface TSelectOption {
  label: string;
  value: string;
}

const buildSelectOptions = (constantMap: Record<string, string>): TSelectOption[] =>
  Object.entries(constantMap).map(([value, label]) => ({
    label,
    value,
}));

const buildEnumOptions = <T extends string>(
  values: T[],
  labels: Record<T, string>
): TSelectOption[] =>
  values.map((value) => ({
    label: labels[value],
    value,
  }));

const getCandidateConstants = () => ({
  casteTree: CASTE_TREE,
  religionTree: RELIGION_TREE,
  religions: buildSelectOptions(RELIGIONS),
  sects: Object.entries(SECTS).reduce<Record<string, TSelectOption[]>>(
    (acc, [religionKey, sectMap]) => {
      acc[religionKey] = buildSelectOptions(sectMap);
      return acc;
    },
    {}
  ),
  sectDetails: Object.entries(SECT_DETAILS).reduce<
    Record<string, Record<string, TSelectOption[]>>
  >((religionAcc, [religionKey, sectDetailMap]) => {
    religionAcc[religionKey] = Object.entries(sectDetailMap).reduce<
      Record<string, TSelectOption[]>
    >((sectAcc, [sectKey, detailMap]) => {
      sectAcc[sectKey] = buildSelectOptions(detailMap);
      return sectAcc;
    }, {});

    return religionAcc;
  }, {}),
  madhhabs: buildSelectOptions(MADHHABS),
  theologicalOrientations: buildSelectOptions(THEOLOGICAL_ORIENTATIONS),
  sufiOrders: buildSelectOptions(SUFI_ORDERS),
  deprecatedGroups: [
    'madhhabs',
    'theologicalOrientations',
    'sufiOrders',
  ],
  relationshipStatuses: buildSelectOptions(RELATIONSHIP_STATUSES),
  childrenStatuses: buildSelectOptions(CHILDREN),
  moveAbroadStatuses: buildSelectOptions(MOVE_ABROAD),
  occupations: buildSelectOptions(OCCUPATIONS),
  highestEducations: buildSelectOptions(HIGHEST_EDUCATION),
  smokeStatuses: buildSelectOptions(SMOKE_STATUSES),
  drinkStatuses: buildSelectOptions(DRINK_STATUSES),
  interests: buildSelectOptions(INTERESTS),
  interestCategories: Object.entries(INTEREST_CATEGORIES).map(
    ([categoryValue, categoryLabel]) => ({
      label: categoryLabel,
      options: INTERESTS_BY_CATEGORY[
        categoryValue as keyof typeof INTERESTS_BY_CATEGORY
      ].map((interestValue) => ({
        label: INTERESTS[interestValue],
        value: interestValue,
      })),
      value: categoryValue,
    })
  ),
  personalityTraits: buildSelectOptions(PERSONALITY_TRAITS),
  candidateCreatorRelations: buildEnumOptions(
    [
      RelationToUser.SELF,
      RelationToUser.FATHER,
      RelationToUser.MOTHER,
      RelationToUser.BROTHER,
      RelationToUser.SISTER,
      RelationToUser.GUARDIAN,
      RelationToUser.RELATIVE,
      RelationToUser.CONSULTANT
    ],
    CANDIDATE_CREATOR_RELATION_LABELS
  ),
  candidateLinkedUserRelations: buildEnumOptions(
    Object.values(CandidateLinkedUserRelation),
    CANDIDATE_LINKED_USER_RELATION_LABELS
  ),
  candidateLinkedUserAccessRoles: buildEnumOptions(
    Object.values(CandidateLinkedUserAccessRole),
    CANDIDATE_LINKED_USER_ACCESS_ROLE_LABELS
  ),
});

export const CandidateConstantService = {
  getCandidateConstants,
};
