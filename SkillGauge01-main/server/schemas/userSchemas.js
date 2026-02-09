import { z } from 'zod';

export const roleEnum = z.enum(['admin', 'project_manager', 'foreman', 'worker']);
export const roleArraySchema = z.array(roleEnum).max(10).default([]);

export const optionalString = (max = 255) => z.string().max(max).optional().or(z.literal(''));

export const workerRegistrationSchema = z.object({
  personal: z.object({
    nationalId: z.string().trim().min(1).max(30),
    fullName: z.string().trim().min(1).max(120),
    birthDate: optionalString(30),
    age: z.union([z.number(), z.string(), z.null(), z.undefined()]).optional()
  }),
  identity: z
    .object({
      issueDate: optionalString(30),
      expiryDate: optionalString(30)
    })
    .default({}),
  address: z.object({
    phone: z.string().trim().min(1).max(20),
    addressOnId: optionalString(500),
    province: optionalString(120),
    district: optionalString(120),
    subdistrict: optionalString(120),
    postalCode: optionalString(20),
    currentAddress: optionalString(500)
  }),
  employment: z.object({
    role: optionalString(50),
    tradeType: optionalString(50),
    experienceYears: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional()
  }),
  credentials: z
    .object({
      email: z.string().trim().email().max(120),
      password: z.union([z.string().min(8), z.undefined(), z.null()]).optional()
    })
    .default({ email: '', password: undefined })
});

export const userListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(120).trim().optional(),
  status: z.string().max(30).optional()
});

export const createUserSchema = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().regex(/^[+0-9]{8,15}$/),
  email: z.string().email().optional().or(z.literal('')),
  password: z.string().min(8),
  status: z.string().max(30).optional().default('active'),
  roles: roleArraySchema
});

export const updateUserSchema = z.object({
  full_name: z.string().min(1).max(120).optional(),
  phone: z.string().regex(/^[+0-9]{8,15}$/).optional(),
  email: z.string().email().or(z.literal('')).optional(),
  password: z.string().min(8).optional(),
  status: z.string().max(30).optional(),
  roles: roleArraySchema.optional()
}).refine(data => Object.keys(data).length > 0, { message: 'No fields to update' });

export const phoneQuerySchema = z.object({ phone: z.string().min(3) });

export const roleKeySchema = z.object({ role: z.enum(['worker', 'foreman', 'project_manager']) });
