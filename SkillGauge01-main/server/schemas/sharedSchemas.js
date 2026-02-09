import { z } from 'zod';

export const roleEnum = z.enum(['admin', 'project_manager', 'foreman', 'worker']);
export const roleArraySchema = z.array(roleEnum).max(10).default([]);
