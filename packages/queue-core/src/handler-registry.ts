import type { PrismaClient } from '@prisma/client';
import { sendEmailHandler } from './handlers/send-email';
import { resizeImageHandler } from './handlers/resize-image';
import { generateReportHandler } from './handlers/generate-report';
import { downloadFileHandler } from './handlers/download-file';

export interface JobContext {
  jobId: string;
  tenantId: string;
  prisma: PrismaClient;
  log: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export type JobHandler = (payload: Record<string, unknown>, ctx: JobContext) => Promise<unknown>;

export const HANDLERS: Record<string, JobHandler> = {};

HANDLERS['send_email'] = sendEmailHandler;
HANDLERS['resize_image'] = resizeImageHandler;
HANDLERS['generate_report'] = generateReportHandler;
HANDLERS['download_file'] = downloadFileHandler;