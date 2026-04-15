import z from 'zod';
import {
  CandidateLinkedUserAccessRole,
  CandidateLinkedUserRelation,
} from './candidateLinkedUser.interface';

const activeOwnerRequiredMessage =
  'Primary linked users must have owner access role';

const linkedUserNameSchema = z
  .string({ error: 'Name must be string type!' })
  .trim()
  .min(2, 'Name must be at least 2 characters long')
  .max(100, 'Name must be at most 100 characters long');

const passwordSchema = z
  .string({ error: 'Password should be string type!' })
  .min(6, 'Password length should be at least 6!')
  .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 number, and 1 special character',
  });

// AUTH USER ADD LINKED USER
export const createCandidateLinkedUserZodSchema = z
  .object({
    name: linkedUserNameSchema,
    email: z.string().trim().email('Please provide a valid email address'),
    password: passwordSchema.optional(),
    relationshipToCandidate: z.nativeEnum(CandidateLinkedUserRelation),
    accessRole: z.nativeEnum(CandidateLinkedUserAccessRole).optional(),
    isPrimary: z.boolean({ error: 'isPrimary must be boolean type!' }).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const resolvedAccessRole =
      data.accessRole ??
      (data.relationshipToCandidate === CandidateLinkedUserRelation.SELF
        ? CandidateLinkedUserAccessRole.OWNER
        : CandidateLinkedUserAccessRole.EDITOR);

    if (data.isPrimary && resolvedAccessRole !== CandidateLinkedUserAccessRole.OWNER) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accessRole'],
        message: activeOwnerRequiredMessage,
      });
    }
  });

// AUTH USER UPDATE LINKED USER
export const updateCandidateLinkedUserZodSchema = z
  .object({
    name: linkedUserNameSchema.optional(),
    relationshipToCandidate: z.nativeEnum(CandidateLinkedUserRelation).optional(),
    accessRole: z.nativeEnum(CandidateLinkedUserAccessRole).optional(),
    isPrimary: z.boolean({ error: 'isPrimary must be boolean type!' }).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update linked user access',
    path: ['accessRole'],
  })
  .superRefine((data, ctx) => {
    if (
      data.isPrimary &&
      data.accessRole !== undefined &&
      data.accessRole !== CandidateLinkedUserAccessRole.OWNER
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['accessRole'],
        message: activeOwnerRequiredMessage,
      });
    }
  });
