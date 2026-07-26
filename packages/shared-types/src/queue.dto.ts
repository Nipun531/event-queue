import { z } from 'zod';

export const CreateQueueSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-_]+$/, 'Queue name must be lowercase letters, numbers, hyphens or underscores only'),
  concurrency: z.number().int().min(1).max(50).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  backoffType: z.enum(['exponential', 'fixed']).optional(),
  backoffDelayMs: z.number().int().min(100).optional(),
});

export type CreateQueueDto = z.infer<typeof CreateQueueSchema>;