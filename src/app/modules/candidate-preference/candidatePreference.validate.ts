import z from 'zod';
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
} from '../../constant/constant';
import { Gender } from '../candidate/candidate.interface';

const toEnumValues = <T extends string>(values: readonly T[]) =>
  values as [T, ...T[]];

const RELIGION_KEYS = toEnumValues(Object.keys(RELIGIONS));
const SECT_KEYS = toEnumValues(
  Array.from(
    new Set(Object.values(SECTS).flatMap((sectMap) => Object.keys(sectMap)))
  )
);
const CAST_KEYS = toEnumValues(Object.keys(CASTS));
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

const strictFiltersSchema = z
  .object({
    gender: z.boolean().optional(),
    age: z.boolean().optional(),
    height: z.boolean().optional(),
    religion: z.boolean().optional(),
    caste: z.boolean().optional(),
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
  castes: enumArraySchema(CAST_KEYS, 'Castes').optional(),
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
};

export const replaceCandidatePreferenceZodSchema = z
  .object(preferenceFields)
  .strict()
  .superRefine(applyPreferenceBusinessRules);

export const updateCandidatePreferenceZodSchema = z
  .object(preferenceFields)
  .strict()
  .superRefine(applyPreferenceBusinessRules);
