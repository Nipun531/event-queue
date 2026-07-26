import { describe, it, expect, vi } from 'vitest';
import { markRunning, markCompleted, markFailed } from './job-state';

function createMockPrisma() {
  return {
    job: {
      update: vi.fn().mockResolvedValue({ id: 'job-1', status: 'RUNNING' }),
    },
    jobLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  } as any;
}

describe('markRunning', () => {
  it('updates status to RUNNING with startedAt and workerId', async () => {
    const prisma = createMockPrisma();

    await markRunning('job-1', 'worker-abc', prisma);

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1', status: 'PENDING' },
      data: expect.objectContaining({
        status: 'RUNNING',
        workerId: 'worker-abc',
        startedAt: expect.any(Date),
      }),
    });
  });

  it('writes an info log entry', async () => {
    const prisma = createMockPrisma();

    await markRunning('job-1', 'worker-abc', prisma);

    expect(prisma.jobLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jobId: 'job-1',
        level: 'info',
        message: 'Job started',
      }),
    });
  });
});

describe('markCompleted', () => {
  it('updates status to COMPLETED with result and completedAt', async () => {
    const prisma = createMockPrisma();
    const result = { sentAt: '2026-01-01T00:00:00Z' };

    await markCompleted('job-1', result, prisma);

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1', status: 'RUNNING' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        result,
        completedAt: expect.any(Date),
      }),
    });
  });
});

describe('markFailed', () => {
  it('updates status to FAILED with error message', async () => {
    const prisma = createMockPrisma();

    await markFailed('job-1', 'Something broke', prisma);

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        error: 'Something broke',
        failedAt: expect.any(Date),
      }),
    });
  });

  it('writes an error log entry', async () => {
    const prisma = createMockPrisma();

    await markFailed('job-1', 'Something broke', prisma);

    expect(prisma.jobLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        level: 'error',
        message: 'Job failed: Something broke',
      }),
    });
  });
});