import { Types } from 'mongoose';
import z from 'zod';

const objectIdSchema = (fieldLabel: string) =>
  z
    .string({ error: `${fieldLabel} is required` })
    .trim()
    .min(1, `${fieldLabel} is required`)
    .refine((value) => Types.ObjectId.isValid(value), {
      message: `Invalid ${fieldLabel.toLowerCase()}`,
    });

export const trackProfileVisitZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
    visitedProfileId: objectIdSchema('Visited profile id'),
  })
  .strict();

export const profileVisitorListQueryZodSchema = z
  .object({
    candidateId: objectIdSchema('Candidate id'),
    limit: z.coerce
      .number({ error: 'Limit must be number type' })
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(50, 'Limit must be at most 50')
      .default(20),
    page: z.coerce
      .number({ error: 'Page must be number type' })
      .int('Page must be an integer')
      .min(1, 'Page must be at least 1')
      .default(1),
  })
  .strict();
