import { z } from 'zod';
import { roleArraySchema } from './sharedSchemas.js';

export const signupSchema = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().regex(/^[+0-9]{8,15}$/),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(8)
});

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(255).optional(),
    phone: z.string().trim().min(1).max(255).optional(),
    password: z.string().min(1)
  })
  .superRefine((data, ctx) => {
    if (!data.identifier && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either identifier or phone must be provided',
        path: ['identifier']
      });
    }
  });
