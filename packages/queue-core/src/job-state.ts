import type { PrismaClient } from '@prisma/client';

export async function markRunning(
  jobId: string,
  workerId: string,
  prisma: PrismaClient
) {
  const job = await prisma.job.update({
    where: { id: jobId, status: 'PENDING' },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      workerId,
    },
  });

  await prisma.jobLog.create({
    data: {
      jobId,
      level: 'info',
      message: 'Job started',
    },
  });

  return job;
}

export async function markCompleted(
  jobId: string,
  result: unknown,
  prisma: PrismaClient
) {
  const job = await prisma.job.update({
    where: { id: jobId, status: 'RUNNING' },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      result: result as object,
    },
  });

  await prisma.jobLog.create({
    data: {
      jobId,
      level: 'info',
      message: 'Job completed',
    },
  });

  return job;
}

export async function markFailed(
  jobId: string,
  error: string,
  prisma: PrismaClient
) {
  const job = await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      failedAt: new Date(),
      error,
    },
  });

  await prisma.jobLog.create({
    data: {
      jobId,
      level: 'error',
      message: `Job failed: ${error}`,
    },
  });

  return job;
}


// Before, every time the worker needed to change a job's status, it wrote a raw Prisma update directly in worker.ts, mixed in with all the polling and Redis logic. That works, but it means the "how do we mark a job as done" logic only exists in one messy, hard-to-test place. By pulling it into three small, focused functions in job-state.ts, you get three benefits: the logic is now testable on its own without needing Redis or a real worker running, it's reusable (Phase 3's workflow engine will need to mark steps completed the exact same way), and it's the single source of truth — if you ever change what "completed" means (say, adding a duration calculation), you change it in one place instead of hunting through worker.ts.