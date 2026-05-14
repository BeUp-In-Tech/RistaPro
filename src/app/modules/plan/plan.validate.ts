import z from 'zod';
import { PLAN_KEYS } from './plan.interface';

// ALLOWED PLAN TYPES
const planTypeSchema = z.enum(PLAN_KEYS, {
  error: 'Plan type must be free, gold, or platinum',
});

// CREATE PLAN VALIDATION
export const createPlanZodSchema = z
  .object({
    planType: planTypeSchema,
    price: z.coerce
      .number({ error: 'Price must be number type!' })
      .min(0, 'Price cannot be negative'),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.planType === 'free' && data.price !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: 'Free plan price must be 0',
      });
    }

    if (data.planType !== 'free' && data.price <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        message: 'Paid plan price must be greater than 0',
      });
    }
  });

// UPDATE PLAN VALIDATION
export const updatePlanZodSchema = z
  .object({
    price: z.coerce
      .number({ error: 'Price must be number type!' })
      .min(0, 'Price cannot be negative')
      .optional(),
    isActive: z.boolean({ error: 'isActive must be boolean type!' }).optional(),
  })
  .strict()
  .refine((data) => data.price !== undefined || data.isActive !== undefined, {
    message: 'At least one field is required to update a plan',
    path: ['price'],
  });
