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
import { Gender, RelationToUser } from './candidate.interface';

const toEnumValues = <T extends string>(values: readonly T[]) =>
  values as [T, ...T[]];

const RELIGION_TREE_KEYS = Object.keys(RELIGION_TREE_RELIGIONS);
const ALL_RELIGION_KEYS = toEnumValues(
  Array.from(new Set([...Object.keys(RELIGIONS), ...RELIGION_TREE_KEYS]))
);
const ALL_SECT_KEYS = toEnumValues(
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

const uniqueStringArray = (fieldLabel: string, values: string[]) =>
  new Set(values).size === values.length ||
  `${fieldLabel} must not contain duplicate values`;

const parseStringifiedArray = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return [value];
  }
};

const normalizeEnumKey = (value: unknown) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const interestsArraySchema = z
  .array(z.enum(INTEREST_KEYS), {
    error: 'Interests must be an array of predefined constant keys',
  })
  .refine(
    (values) => uniqueStringArray('Interests', values) === true,
    'Interests must not contain duplicate values'
  );

const personalityArraySchema = z
  .array(z.enum(PERSONALITY_KEYS), {
    error: 'Personality must be an array of predefined constant keys',
  })
  .refine(
    (values) => uniqueStringArray('Personality', values) === true,
    'Personality must not contain duplicate values'
  );

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
  religionId: string | undefined,
  sectId: string | undefined,
  groupId: string,
  optionId: string | undefined
) =>
  Boolean(
    optionId &&
      getReligionSectNode(religionId, sectId)
        ?.detailGroups?.find((group) => group.id === groupId)
        ?.options.some((option) => option.id === optionId)
  );

const deletedImagesSchema = z.preprocess(
  parseStringifiedArray,
  z
    .array(
      z
        .string({ error: 'Deleted image link must be string type!' })
        .trim()
        .min(1, 'Deleted image link cannot be empty')
    )
    .refine(
      (values) => uniqueStringArray('Deleted images', values) === true,
      'Deleted images must not contain duplicate values'
    )
);

const deletedInterestsSchema = z.preprocess(
  parseStringifiedArray,
  interestsArraySchema
);
const updateInterestsSchema = z.preprocess(
  parseStringifiedArray,
  interestsArraySchema
);
const updatePersonalitySchema = z.preprocess(
  parseStringifiedArray,
  personalityArraySchema
);
const deletedPersonalitySchema = z.preprocess(
  parseStringifiedArray,
  personalityArraySchema
);

const religiousFieldsSchema = z
  .object({
    religion: z
      .preprocess(normalizeEnumKey, z.enum(ALL_RELIGION_KEYS, {
        error: 'Religion must be one of the predefined constant keys',
      }))
      .optional(),
    sect: z
      .preprocess(normalizeEnumKey, z.enum(ALL_SECT_KEYS, {
        error: 'Sect must be one of the predefined constant keys',
      }))
      .optional(),
    sectDetail: z
      .preprocess(normalizeEnumKey, z.enum(SECT_DETAIL_KEYS, {
        error: 'Sect detail must be one of the predefined constant keys',
      }))
      .optional(),
    madhhab: z
      .preprocess(normalizeEnumKey, z.enum(MADHHAB_KEYS, {
        error: 'Madhhab must be one of the predefined constant keys',
      }))
      .optional(),
    movement: z
      .preprocess(normalizeEnumKey, z.enum(MOVEMENT_KEYS, {
        error: 'Movement must be one of the predefined constant keys',
      }))
      .optional(),
    theologicalOrientation: z
      .preprocess(normalizeEnumKey, z.enum(THEOLOGICAL_ORIENTATION_KEYS, {
        error: 'Theological orientation must be one of the predefined constant keys',
      }))
      .optional(),
    sufiOrder: z
      .preprocess(normalizeEnumKey, z.enum(SUFI_ORDER_KEYS, {
        error: 'Sufi order must be one of the predefined constant keys',
      }))
      .optional(),
  })
  .strict();

const casteIdentityFieldsSchema = z
  .object({
    category: z
      .enum(CASTE_CATEGORY_KEYS, {
        error: 'Caste category must be one of the predefined constant keys',
      })
      .optional(),
    caste: z
      .enum(CAST_KEYS, {
        error: 'Caste must be one of the predefined constant keys',
      })
      .optional(),
    clan: z
      .enum(CLAN_KEYS, {
        error: 'Clan must be one of the predefined constant keys',
      })
      .optional(),
  })
  .strict();

const candidateSchemaFields = {
  name: z
    .string({ error: 'Name must be string type!' })
    .trim()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name must be at most 100 characters long'),
  dateOfBirth: z.coerce
    .date({ error: 'Date of birth must be a valid date!' })
    .refine(
      (value) => value.getTime() < Date.now(),
      'Date of birth must be in the past'
    ),
  gender: z.nativeEnum(Gender),
  height: z.coerce
    .number({ error: 'Height must be number type!' })
    .min(1, 'Height must be greater than 0')
    .max(300, 'Height must be at most 300')
    .optional(),
  religious: religiousFieldsSchema.optional(),
  casteIdentity: casteIdentityFieldsSchema.optional(),
  religion: z
    .preprocess(normalizeEnumKey, z.enum(ALL_RELIGION_KEYS, {
      error: 'Religion must be one of the predefined constant keys',
    }))
    .optional(),
  sect: z
    .preprocess(normalizeEnumKey, z.enum(ALL_SECT_KEYS, {
      error: 'Sect must be one of the predefined constant keys',
    }))
    .optional(),
  sectDetail: z
    .preprocess(normalizeEnumKey, z.enum(SECT_DETAIL_KEYS, {
      error: 'Sect detail must be one of the predefined constant keys',
    }))
    .optional(),
  madhhab: z
    .preprocess(normalizeEnumKey, z.enum(MADHHAB_KEYS, {
      error: 'Madhhab must be one of the predefined constant keys',
    }))
    .optional(),
  movement: z
    .preprocess(normalizeEnumKey, z.enum(MOVEMENT_KEYS, {
      error: 'Movement must be one of the predefined constant keys',
    }))
    .optional(),
  theologicalOrientation: z
    .preprocess(normalizeEnumKey, z.enum(THEOLOGICAL_ORIENTATION_KEYS, {
      error: 'Theological orientation must be one of the predefined constant keys',
    }))
    .optional(),
  sufiOrder: z
    .preprocess(normalizeEnumKey, z.enum(SUFI_ORDER_KEYS, {
      error: 'Sufi order must be one of the predefined constant keys',
    }))
    .optional(),
  profile_assist: z
    .string({ error: 'Profile assist must be string type!' })
    .trim()
    .min(1, 'Profile assist cannot be empty')
    .max(100, 'Profile assist must be at most 100 characters long')
    .optional(),
  relationship_status: z
    .enum(RELATIONSHIP_STATUS_KEYS, {
      error: 'Relationship status must be one of the predefined constant keys',
    })
    .optional(),
  have_children: z
    .enum(CHILDREN_KEYS, {
      error: 'Children status must be one of the predefined constant keys',
    })
    .optional(),
  move_abroad: z
    .enum(MOVE_ABROAD_KEYS, {
      error: 'Move abroad status must be one of the predefined constant keys',
    })
    .optional(),
  occupation: z
    .enum(OCCUPATION_KEYS, {
      error: 'Occupation must be one of the predefined constant keys',
    })
    .optional(),
  highest_education: z
    .enum(HIGHEST_EDUCATION_KEYS, {
      error: 'Highest education must be one of the predefined constant keys',
    })
    .optional(),
  smoke_status: z
    .enum(SMOKE_STATUS_KEYS, {
      error: 'Smoke status must be one of the predefined constant keys',
    })
    .optional(),
  drink_status: z
    .enum(DRINK_STATUS_KEYS, {
      error: 'Drink status must be one of the predefined constant keys',
    })
    .optional(),
  interests: interestsArraySchema.optional(),
  personality: personalityArraySchema.optional(),
  relationToUser: z
    .nativeEnum(RelationToUser)
    .default(RelationToUser.SELF),
  bio: z
    .string({ error: 'Bio must be string type!' })
    .trim()
    .min(1, 'Bio cannot be empty')
    .max(1500, 'Bio must be at most 1500 characters long')
    .optional(),
  address: z
    .string({ error: 'Address must be string type!' })
    .trim()
    .min(1, 'Address cannot be empty')
    .max(300, 'Address must be at most 300 characters long')
    .optional(),
  coordinates: z
    .tuple(
      [
        z.coerce.number({ error: 'Longitude must be number type!' }),
        z.coerce.number({ error: 'Latitude must be number type!' }),
      ],
      { error: 'Coordinates must contain longitude and latitude' }
    )
    .optional(),
};

const applyCandidateBusinessRules = (
  data: Partial<z.infer<z.ZodObject<typeof candidateSchemaFields>>>,
  ctx: z.RefinementCtx,
  options: { requireReligiousParents?: boolean } = {}
) => {
  const religious = {
    religion: data.religion,
    sect: data.sect,
    sectDetail: data.sectDetail,
    madhhab: data.madhhab,
    movement: data.movement,
    theologicalOrientation: data.theologicalOrientation,
    sufiOrder: data.sufiOrder,
    ...(data.religious ?? {}),
  };
  const casteIdentity = {
    ...(data.casteIdentity ?? {}),
  };

  if (options.requireReligiousParents && religious.sect && !religious.religion) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: data.religious ? ['religious', 'religion'] : ['religion'],
      message: 'Religion is required when sect is provided',
    });
  }

  if (religious.religion && religious.sect) {
    const religionKey = religious.religion as keyof typeof SECTS;
    const religionSects = SECTS[religionKey]
      ? Object.keys(SECTS[religionKey])
      : [];
    const treeReligionSectIds: string[] =
      getReligionNode(religious.religion)?.sects.map((sect) => sect.id) ?? [];

    if (
      religionSects.length + treeReligionSectIds.length > 0 &&
      !religionSects.includes(religious.sect) &&
      !treeReligionSectIds.includes(religious.sect)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.religious ? ['religious', 'sect'] : ['sect'],
        message: 'Selected sect does not belong to the selected religion',
      });
    }
  }

  if (
    options.requireReligiousParents &&
    religious.sectDetail &&
    (!religious.religion || !religious.sect)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: data.religious ? ['religious', 'sectDetail'] : ['sectDetail'],
      message: 'Religion and sect are required when sect detail is provided',
    });
  }

  if (religious.religion && religious.sect && religious.sectDetail) {
    const religionDetails =
      SECT_DETAILS[religious.religion as keyof typeof SECT_DETAILS] ?? {};
    const sectDetails =
      religionDetails[religious.sect as keyof typeof religionDetails] ?? {};

    if (!Object.keys(sectDetails).includes(religious.sectDetail)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.religious ? ['religious', 'sectDetail'] : ['sectDetail'],
        message: 'Selected sect detail does not belong to the selected religion and sect',
      });
    }
  }

  if (casteIdentity.category && casteIdentity.caste && CASTE_TREE_CASTES[casteIdentity.caste]) {
    if (!getCasteNode(casteIdentity.category, casteIdentity.caste)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['casteIdentity', 'caste'],
        message: 'Selected caste does not belong to the selected caste category',
      });
    }
  }

  if (casteIdentity.clan && (!casteIdentity.category || !casteIdentity.caste)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['casteIdentity', 'clan'],
      message: 'Caste category and caste are required when clan is provided',
    });
  }

  if (casteIdentity.category && casteIdentity.caste && casteIdentity.clan) {
    const casteNode = getCasteNode(casteIdentity.category, casteIdentity.caste);

    if (!casteNode?.clans?.some((clan) => clan.id === casteIdentity.clan)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['casteIdentity', 'clan'],
        message: 'Selected clan does not belong to the selected caste',
      });
    }
  }

  if (religious.madhhab && RELIGION_TREE_MADHHABS[religious.madhhab]) {
    if (options.requireReligiousParents && (!religious.religion || !religious.sect)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.religious ? ['religious', 'madhhab'] : ['madhhab'],
        message: 'Religion and sect are required when madhhab is provided',
      });
    } else if (
      religious.religion &&
      religious.sect &&
      !hasReligionDetailOption(religious.religion, religious.sect, 'madhhab', religious.madhhab)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.religious ? ['religious', 'madhhab'] : ['madhhab'],
        message: 'Selected madhhab does not belong to the selected religion and sect',
      });
    }
  }

  if (religious.movement) {
    if (options.requireReligiousParents && (!religious.religion || !religious.sect)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.religious ? ['religious', 'movement'] : ['movement'],
        message: 'Religion and sect are required when movement is provided',
      });
    } else if (
      religious.religion &&
      religious.sect &&
      !hasReligionDetailOption(religious.religion, religious.sect, 'movement', religious.movement)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: data.religious ? ['religious', 'movement'] : ['movement'],
        message: 'Selected movement does not belong to the selected religion and sect',
      });
    }
  }
};

// Candidate profile create validation.
export const createCandidateZodSchema = z
  .object(candidateSchemaFields)
  .strict()
  .superRefine((data, ctx) =>
    applyCandidateBusinessRules(data, ctx, { requireReligiousParents: true })
  );

// Candidate profile update validation for future update endpoints.
export const updateCandidateZodSchema = z
  .object({
    ...candidateSchemaFields,
    // KEEP UPDATE SAFE: DO NOT AUTO-DEFAULT RELATION ON PATCH.
    relationToUser: z.nativeEnum(RelationToUser).optional(),
    interests: updateInterestsSchema.optional(),
    deletedInterests: deletedInterestsSchema.optional(),
    personality: updatePersonalitySchema.optional(),
    deletedPersonality: deletedPersonalitySchema.optional(),
    deletedImages: deletedImagesSchema.optional(),
  })
  .partial()
  .strict()
  .superRefine(applyCandidateBusinessRules);
