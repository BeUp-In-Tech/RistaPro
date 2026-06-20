import z from 'zod';
import {
  CASTE_CATEGORIES,
  CASTE_CLANS,
  CASTE_TREE,
  CASTE_TREE_CASTES,
  CHILDREN,
  DRINK_STATUSES,
  HIGHEST_EDUCATION,
  INTERESTS,
  MADHHABS,
  RELIGION_TREE,
  RELIGION_TREE_MADHHABS,
  RELIGION_TREE_MOVEMENTS,
  RELIGION_TREE_RELIGIONS,
  RELIGION_TREE_SECTS,
  MOVE_ABROAD,
  OCCUPATIONS,
  PERSONALITY_TRAITS,
  RELATIONSHIP_STATUSES,
  RELIGIONS,
  SECTS,
  SECT_DETAILS,
  SECT_DETAIL_VALUES,
  SMOKE_STATUSES,
  SUFI_ORDERS,
  THEOLOGICAL_ORIENTATIONS,
  TCasteCategoryNode,
  TCasteNode,
  TReligionSectNode,
  TReligionTreeNode,
} from '../../constant/constant';
import { Gender } from '../candidate/candidate.interface';

const toEnumValues = <T extends string>(values: readonly T[]) =>
  values as [T, ...T[]];

const RELIGION_KEYS = toEnumValues(
  Array.from(
    new Set([...Object.keys(RELIGIONS), ...Object.keys(RELIGION_TREE_RELIGIONS)])
  )
);
const SECT_KEYS = toEnumValues(
  Array.from(
    new Set([
      ...Object.values(SECTS).flatMap((sectMap) => Object.keys(sectMap)),
      ...Object.keys(RELIGION_TREE_SECTS),
    ])
  )
);
const SECT_DETAIL_KEYS = toEnumValues(Object.keys(SECT_DETAIL_VALUES));
const CAST_KEYS = toEnumValues(Object.keys(CASTE_TREE_CASTES));
const CASTE_CATEGORY_KEYS = toEnumValues(Object.keys(CASTE_CATEGORIES));
const CLAN_KEYS = toEnumValues(Object.keys(CASTE_CLANS));
const MADHHAB_KEYS = toEnumValues(
  Array.from(new Set([...Object.keys(MADHHABS), ...Object.keys(RELIGION_TREE_MADHHABS)]))
);
const MOVEMENT_KEYS = toEnumValues(Object.keys(RELIGION_TREE_MOVEMENTS));
const THEOLOGICAL_ORIENTATION_KEYS = toEnumValues(
  Object.keys(THEOLOGICAL_ORIENTATIONS)
);
const SUFI_ORDER_KEYS = toEnumValues(Object.keys(SUFI_ORDERS));
const RELATIONSHIP_STATUS_KEYS = toEnumValues(
  Object.keys(RELATIONSHIP_STATUSES)
);
const CHILDREN_KEYS = toEnumValues(Object.keys(CHILDREN));
const MOVE_ABROAD_KEYS = toEnumValues(Object.keys(MOVE_ABROAD));
const OCCUPATION_KEYS = toEnumValues(Object.keys(OCCUPATIONS));
const HIGHEST_EDUCATION_KEYS = toEnumValues(Object.keys(HIGHEST_EDUCATION));
const SMOKE_STATUS_KEYS = toEnumValues(Object.keys(SMOKE_STATUSES));
const DRINK_STATUS_KEYS = toEnumValues(Object.keys(DRINK_STATUSES));
const INTEREST_KEYS = toEnumValues(Object.keys(INTERESTS));
const PERSONALITY_KEYS = toEnumValues(Object.keys(PERSONALITY_TRAITS));

const uniqueArray = (fieldLabel: string, values: string[]) =>
  new Set(values).size === values.length ||
  `${fieldLabel} must not contain duplicate values`;

const enumArraySchema = <T extends [string, ...string[]]>(
  keys: T,
  fieldLabel: string
) =>
  z
    .array(z.enum(keys), {
      error: `${fieldLabel} must be an array of predefined constant keys`,
    })
    .refine(
      (values) => uniqueArray(fieldLabel, values) === true,
      `${fieldLabel} must not contain duplicate values`
    );

const nullableNumber = (fieldLabel: string, min: number, max: number) =>
  z
    .union([
      z.coerce
        .number({ error: `${fieldLabel} must be number type!` })
        .min(min, `${fieldLabel} must be at least ${min}`)
        .max(max, `${fieldLabel} must be at most ${max}`),
      z.null(),
    ])
    .optional();

const getCasteCategoryNode = (categoryId?: string) =>
  (CASTE_TREE as readonly TCasteCategoryNode[]).find(
    (category) => category.id === categoryId
  );

const getCasteNode = (categoryId?: string, casteId?: string) =>
  getCasteCategoryNode(categoryId)?.castes.find(
    (caste): caste is TCasteNode => caste.id === casteId
  );

const getReligionNode = (religionId?: string) =>
  (RELIGION_TREE as readonly TReligionTreeNode[]).find(
    (religion) => religion.id === religionId
  );

const getReligionSectNode = (religionId?: string, sectId?: string) =>
  getReligionNode(religionId)?.sects.find(
    (sect): sect is TReligionSectNode => sect.id === sectId
  );

const hasReligionDetailOption = (
  religionId: string,
  sectId: string,
  groupId: string,
  optionId: string
) =>
  Boolean(
    getReligionSectNode(religionId, sectId)
      ?.detailGroups?.find((group) => group.id === groupId)
      ?.options.some((option) => option.id === optionId)
  );

const strictFiltersSchema = z
  .object({
    gender: z.boolean().optional(),
    age: z.boolean().optional(),
    height: z.boolean().optional(),
    religion: z.boolean().optional(),
    sectDetail: z.boolean().optional(),
    caste: z.boolean().optional(),
    casteCategory: z.boolean().optional(),
    clan: z.boolean().optional(),
    madhhab: z.boolean().optional(),
    movement: z.boolean().optional(),
    theologicalOrientation: z.boolean().optional(),
    sufiOrder: z.boolean().optional(),
    location: z.boolean().optional(),
  })
  .strict();

const preferenceFields = {
  preferredGenders: z
    .array(z.nativeEnum(Gender), {
      error: 'Preferred genders must be an array of valid gender values',
    })
    .min(1, 'At least one preferred gender is required')
    .refine(
      (values) => uniqueArray('Preferred genders', values) === true,
      'Preferred genders must not contain duplicate values'
    )
    .optional(),
  ageMin: nullableNumber('Minimum age', 18, 100),
  ageMax: nullableNumber('Maximum age', 18, 100),
  heightMin: nullableNumber('Minimum height', 1, 300),
  heightMax: nullableNumber('Maximum height', 1, 300),
  religions: enumArraySchema(RELIGION_KEYS, 'Religions').optional(),
  sects: enumArraySchema(SECT_KEYS, 'Sects').optional(),
  sectDetails: enumArraySchema(SECT_DETAIL_KEYS, 'Sect details').optional(),
  casteCategories: enumArraySchema(CASTE_CATEGORY_KEYS, 'Caste categories').optional(),
  castes: enumArraySchema(CAST_KEYS, 'Castes').optional(),
  clans: enumArraySchema(CLAN_KEYS, 'Clans').optional(),
  madhhabs: enumArraySchema(MADHHAB_KEYS, 'Madhhabs').optional(),
  movements: enumArraySchema(MOVEMENT_KEYS, 'Movements').optional(),
  theologicalOrientations: enumArraySchema(
    THEOLOGICAL_ORIENTATION_KEYS,
    'Theological orientations'
  ).optional(),
  sufiOrders: enumArraySchema(SUFI_ORDER_KEYS, 'Sufi orders').optional(),
  relationship_statuses: enumArraySchema(
    RELATIONSHIP_STATUS_KEYS,
    'Relationship statuses'
  ).optional(),
  have_children: enumArraySchema(CHILDREN_KEYS, 'Children preferences').optional(),
  move_abroad: enumArraySchema(MOVE_ABROAD_KEYS, 'Move abroad preferences').optional(),
  occupations: enumArraySchema(OCCUPATION_KEYS, 'Occupations').optional(),
  highest_educations: enumArraySchema(
    HIGHEST_EDUCATION_KEYS,
    'Highest educations'
  ).optional(),
  smoke_statuses: enumArraySchema(SMOKE_STATUS_KEYS, 'Smoke statuses').optional(),
  drink_statuses: enumArraySchema(DRINK_STATUS_KEYS, 'Drink statuses').optional(),
  interests: enumArraySchema(INTEREST_KEYS, 'Interests').optional(),
  personality: enumArraySchema(PERSONALITY_KEYS, 'Personality').optional(),
  maxDistanceKm: nullableNumber('Maximum distance', 1, 10000),
  strictFilters: strictFiltersSchema.optional(),
};

const applyPreferenceBusinessRules = (
  data: Partial<Record<keyof typeof preferenceFields, unknown>>,
  ctx: z.RefinementCtx
) => {
  const ageMin = data.ageMin;
  const ageMax = data.ageMax;
  const heightMin = data.heightMin;
  const heightMax = data.heightMax;
  const religions = data.religions as string[] | undefined;
  const sects = data.sects as string[] | undefined;
  const sectDetails = data.sectDetails as string[] | undefined;
  const casteCategories = data.casteCategories as string[] | undefined;
  const castes = data.castes as string[] | undefined;
  const clans = data.clans as string[] | undefined;
  const madhhabs = data.madhhabs as string[] | undefined;
  const movements = data.movements as string[] | undefined;

  if (
    typeof ageMin === 'number' &&
    typeof ageMax === 'number' &&
    ageMin > ageMax
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ageMax'],
      message: 'Maximum age must be greater than or equal to minimum age',
    });
  }

  if (
    typeof heightMin === 'number' &&
    typeof heightMax === 'number' &&
    heightMin > heightMax
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['heightMax'],
      message: 'Maximum height must be greater than or equal to minimum height',
    });
  }

  if (religions?.length && sects?.length) {
    const allowedSects = new Set(
      religions.flatMap((religion) =>
        SECTS[religion as keyof typeof SECTS]
          ? Object.keys(SECTS[religion as keyof typeof SECTS])
          : []
      ).concat(
        religions.flatMap(
          (religion) => getReligionNode(religion)?.sects.map((sect) => sect.id) ?? []
        )
      )
    );

    const invalidSect = sects.find((sect) => !allowedSects.has(sect));

    if (invalidSect) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sects'],
        message: 'Selected sects must belong to the selected religions',
      });
    }
  }

  if (religions?.length && sects?.length && sectDetails?.length) {
    const allowedSectDetails = new Set(
      religions.flatMap((religion) => {
        const detailsBySect =
          SECT_DETAILS[religion as keyof typeof SECT_DETAILS] ?? {};

        return sects.flatMap((sect) => {
          const details =
            detailsBySect[sect as keyof typeof detailsBySect] ?? {};
          return Object.keys(details);
        });
      })
    );

    const invalidSectDetail = sectDetails.find(
      (sectDetail) => !allowedSectDetails.has(sectDetail)
    );

    if (invalidSectDetail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sectDetails'],
        message:
          'Selected sect details must belong to the selected religions and sects',
      });
    }
  }

  if (casteCategories?.length && castes?.length) {
    const allowedCastes = new Set(
      casteCategories.flatMap(
        (category) => getCasteCategoryNode(category)?.castes.map((caste) => caste.id) ?? []
      )
    );
    const invalidCaste = castes.find(
      (caste) => CASTE_TREE_CASTES[caste] && !allowedCastes.has(caste)
    );

    if (invalidCaste) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['castes'],
        message: 'Selected castes must belong to the selected caste categories',
      });
    }
  }

  if (clans?.length && (!casteCategories?.length || !castes?.length)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['clans'],
      message: 'Caste categories and castes are required when clans are provided',
    });
  }

  if (casteCategories?.length && castes?.length && clans?.length) {
    const allowedClans = new Set(
      casteCategories.flatMap((category) =>
        castes.flatMap(
          (caste) => getCasteNode(category, caste)?.clans?.map((clan) => clan.id) ?? []
        )
      )
    );
    const invalidClan = clans.find((clan) => !allowedClans.has(clan));

    if (invalidClan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clans'],
        message: 'Selected clans must belong to the selected caste categories and castes',
      });
    }
  }

  if (religions?.length && sects?.length && madhhabs?.length) {
    const invalidMadhhab = madhhabs.find(
      (madhhab) =>
        RELIGION_TREE_MADHHABS[madhhab] &&
        !religions.some((religion) =>
          sects.some((sect) =>
            hasReligionDetailOption(religion, sect, 'madhhab', madhhab)
          )
        )
    );

    if (invalidMadhhab) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['madhhabs'],
        message: 'Selected madhhabs must belong to the selected religions and sects',
      });
    }
  }

  if (movements?.length && (!religions?.length || !sects?.length)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['movements'],
      message: 'Religions and sects are required when movements are provided',
    });
  }

  if (religions?.length && sects?.length && movements?.length) {
    const invalidMovement = movements.find(
      (movement) =>
        !religions.some((religion) =>
          sects.some((sect) =>
            hasReligionDetailOption(religion, sect, 'movement', movement)
          )
        )
    );

    if (invalidMovement) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['movements'],
        message: 'Selected movements must belong to the selected religions and sects',
      });
    }
  }
};

export const replaceCandidatePreferenceZodSchema = z
  .object(preferenceFields)
  .strict()
  .superRefine(applyPreferenceBusinessRules);

export const updateCandidatePreferenceZodSchema = z
  .object(preferenceFields)
  .strict()
  .superRefine(applyPreferenceBusinessRules);
