import { z } from 'zod';

export const CreateJobSchema = z.object({
  queue: z.string().min(1),
  type: z.string().min(1),
  payload: z.record(z.unknown()).optional().default({}),
  priority: z.number().int().min(0).max(10).optional().default(0),
  runAt: z.string().datetime().optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
});

export type CreateJobDto = z.infer<typeof CreateJobSchema>;

export const ListJobsQuerySchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'DEAD', 'CANCELLED']).optional(),
  queue: z.string().optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListJobsQueryDto = z.infer<typeof ListJobsQuerySchema>;