import z from 'zod';
import { ActiveStatus, IPlatform } from './user.interface';
import { PLAN_KEYS } from '../plan/plan.interface';

const passwordSchema = z
  .string({ error: 'Password should be string type!' })
  .min(6, 'Password length should be at least 6!')
  .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/, {
    message:
      'Password must contain at least 1 uppercase letter, 1 number, and 1 special character',
  });

const fullNameSchema = z
  .string({ error: 'Full name must be string type!' })
  .min(3, 'Full name must be at least 3 characters long')
  .max(100, 'Full name must be at most 100 characters long');

// ADMIN CREATE CONSULTANT
export const createConsultantZodSchema = z
  .object({
    full_name: fullNameSchema,
    email: z.string().email('Please provide a valid email address'),
    password: passwordSchema
  })
  .strict();

// AUTH USER PROFILE UPDATE
export const updateMyProfileZodSchema = z
  .object({
    full_name: fullNameSchema.optional(),
    picture: z.string({ error: 'Picture must be string type!' }).optional(),
  });

// ADMIN USER UPDATE
export const updateUserByAdminZodSchema = z
  .object({
    full_name: fullNameSchema.optional(),
    picture: z.string({ error: 'Picture must be string type!' }).optional(),
    plan: z.enum(PLAN_KEYS, { error: 'Plan must be a valid plan type!' }).optional(),
    isVerified: z.boolean({ error: 'isVerified must be boolean type!' }).optional(),
    isActive: z.nativeEnum(ActiveStatus).optional(),
  });

// AUTH USER VERIFY PROFILE
export const verifyProfileOtpZodSchema = z
  .object({
    otp: z.coerce
      .string({ error: 'OTP must be string type!' })
      .length(6, 'OTP must be 6 digits'),
  })
  .strict();

// AUTH USER REGISTER DEVICE TOKEN
export const registerDeviceTokenZodSchema = z
  .object({
    token: z.string({ error: 'FCM token must be string type!' }).min(1),
    platform: z.nativeEnum(IPlatform),
    deviceId: z.string({ error: 'deviceId must be string type!' }).min(1),
    deviceName: z.string({ error: 'deviceName must be string type!' }).optional(),
  })
  .strict();
