import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('validation.email.invalid').max(255),
  password: z.string().min(1, 'validation.password.required'),
});

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'validation.username.min')
    .max(50, 'validation.username.max')
    .regex(/^[a-zA-Z0-9_.-]+$/, 'validation.username.pattern'),
  email: z.string().trim().email('validation.email.invalid').max(255),
  password: z
    .string()
    .min(8, 'validation.password.min')
    .max(128, 'validation.password.max'),
  displayName: z
    .string()
    .trim()
    .max(100, 'validation.displayName.max')
    .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
