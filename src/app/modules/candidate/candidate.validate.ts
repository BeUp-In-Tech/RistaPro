import z from 'zod';
import {
  CASTS,
  CHILDREN,
  DRINK_STATUSES,
  HIGHEST_EDUCATION,
  INTERESTS,
  MOVE_ABROAD,
  PERSONALITY_TRAITS,
  RELATIONSHIP_STATUSES,
  RELIGIONS,
  SECTS,
  SMOKE_STATUSES,
} from '../../constant/constant';
import { Gender, RelationToUser } from './candidate.interface';

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
const HIGHEST_EDUCATION_KEYS = toEnumValues(Object.keys(HIGHEST_EDUCATION));
const SMOKE_STATUS_KEYS = toEnumValues(Object.keys(SMOKE_STATUSES));
const DRINK_STATUS_KEYS = toEnumValues(Object.keys(DRINK_STATUSES));
const INTEREST_KEYS = toEnumValues(Object.keys(INTERESTS));
const PERSONALITY_KEYS = toEnumValues(Object.keys(PERSONALITY_TRAITS));

const uniqueStringArray = (fieldLabel: string, values: string[]) =>
  new Set(values).size === values.length ||
  `${fieldLabel} must not contain duplicate values`;


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
  religion: z
    .enum(RELIGION_KEYS, {
      error: 'Religion must be one of the predefined constant keys',
    })
    .optional(),
  sect: z
    .enum(SECT_KEYS, {
      error: 'Sect must be one of the predefined constant keys',
    })
    .optional(),
  caste: z
    .enum(CAST_KEYS, {
      error: 'Caste must be one of the predefined constant keys',
    })
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
    .string({ error: 'Occupation must be string type!' })
    .trim()
    .min(1, 'Occupation cannot be empty')
    .max(120, 'Occupation must be at most 120 characters long')
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
  interests: z
    .array(z.enum(INTEREST_KEYS), {
      error: 'Interests must be an array of predefined constant keys',
    })
    .refine(
      (values) => uniqueStringArray('Interests', values) === true,
      'Interests must not contain duplicate values'
    )
    .optional(),
  personality: z
    .array(z.enum(PERSONALITY_KEYS), {
      error: 'Personality must be an array of predefined constant keys',
    })
    .refine(
      (values) => uniqueStringArray('Personality', values) === true,
      'Personality must not contain duplicate values'
    )
    .optional(),
  relationToUser: z
    .nativeEnum(RelationToUser)
    .default(RelationToUser.SELF),
  partnerExpectation: z
    .string({ error: 'Partner expectation must be string type!' })
    .trim()
    .min(1, 'Partner expectation cannot be empty')
    .max(1000, 'Partner expectation must be at most 1000 characters long')
    .optional(),
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
  ctx: z.RefinementCtx
) => {
  if (data.sect && !data.religion) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['religion'],
      message: 'Religion is required when sect is provided',
    });
  }

  if (data.religion && data.sect) {
    const religionKey = data.religion as keyof typeof SECTS;
    const religionSects = SECTS[religionKey]
      ? Object.keys(SECTS[religionKey])
      : [];

    if (!religionSects.includes(data.sect)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sect'],
        message: 'Selected sect does not belong to the selected religion',
      });
    }
  }};

// Candidate profile create validation.
export const createCandidateZodSchema = z
  .object(candidateSchemaFields)
  .strict()
  .superRefine(applyCandidateBusinessRules);

// Candidate profile update validation for future update endpoints.
export const updateCandidateZodSchema = z
  .object(candidateSchemaFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update a candidate profile',
    path: ['name'],
  })
  .superRefine(applyCandidateBusinessRules);
