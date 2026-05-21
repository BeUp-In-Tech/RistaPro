import z from 'zod';

export const notificationListQueryZodSchema = z
  .object({
    isSeen: z.coerce.boolean().optional(),
    page: z.coerce
      .number({ error: 'Page must be number type' })
      .int('Page must be an integer')
      .min(1, 'Page must be at least 1')
      .default(1),
    limit: z.coerce
      .number({ error: 'Limit must be number type' })
      .int('Limit must be an integer')
      .min(1, 'Limit must be at least 1')
      .max(100, 'Limit must be at most 100')
      .default(20),
  })
  .strict();
