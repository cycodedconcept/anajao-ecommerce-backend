import { z } from 'zod';
export const email = z
  .string()
  .trim()
  .max(254)
  .email()
  .transform((v) => v.toLowerCase());
export const password = z.string().min(12).max(128);
export const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const code = z.string().regex(/^\d{6}$/);
export const registerSchema = z
  .object({ email, password, displayName: z.string().trim().min(1).max(100) })
  .strict();
export const loginSchema = z
  .object({
    email,
    password: z.string().min(1).max(128),
    code: code.optional(),
  })
  .strict();
export const emailSchema = z.object({ email }).strict();
export const tokenSchema = z.object({ token }).strict();
export const refreshSchema = z.object({ refreshToken: token }).strict();
export const resetSchema = z.object({ token, password }).strict();
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), password })
  .strict();
export const profileSchema = z
  .object({ displayName: z.string().trim().min(1).max(100).optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const phoneSchema = z
  .object({ phone: z.string().regex(/^\+[1-9]\d{7,14}$/) })
  .strict();
export const mfaSetupSchema = z
  .object({ password: z.string().min(1).max(128) })
  .strict();
export const mfaConfirmSchema = z.object({ code }).strict();
export const privacySchema = z
  .object({
    kind: z.enum(['EXPORT', 'DELETE']),
    password: z.string().min(1).max(128),
  })
  .strict();
export const addressSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    recipient: z.string().trim().min(1).max(100),
    line1: z.string().trim().min(1).max(150),
    line2: z.string().trim().max(150).nullable().optional(),
    city: z.string().trim().min(1).max(100),
    region: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().max(20).nullable().optional(),
    country: z.string().regex(/^[A-Z]{2}$/),
  })
  .strict();
export const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type Registration = z.infer<typeof registerSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request');
  return result.data;
}
import { AppError } from '../../common/errors/app-error.js';
