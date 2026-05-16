import z from 'zod';
import { Types } from 'mongoose';
import { LikeType } from './like.interface';

export const likeListQueryZodSchema = z
  .object({
    candidateId: z
      .string({ error: 'Candidate id is required' })
      .trim()
      .min(1, 'Candidate id is required')
      .refine((value) => Types.ObjectId.isValid(value), {
        message: 'Invalid candidate id',
      }),
    limit: z.coerce
      .number({ error: 'Limit must be number type!' })
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(50, 'Limit must be at most 50')
      .default(20),
    page: z.coerce
      .number({ error: 'Page must be number type!' })
      .int('Page must be an integer')
      .min(1, 'Page must be at least 1')
      .default(1),
    sort: z
      .string({ error: 'Sort must be string type!' })
      .trim()
      .min(1, 'Sort cannot be empty')
      .optional(),
    type: z
      .enum([LikeType.LIKE, LikeType.SUPER_LIKE], {
        error: 'Type must be LIKE or SUPER_LIKE',
      })
      .optional(),
  })
  .strict();
