import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { HANDLERS,markRunning,markCompleted,markFailed } from '@event-queue/queue-core';

import Redis from 'ioredis';
import * as os from 'os';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const redis = new Redis(process.env.REDIS_URL!);

const QUEUES = (process.env.QUEUES ?? 'emails').split(',');
const WORKER_ID = `${os.hostname()}-${process.pid}`;

async function executePriorityJob(jobId: string, queueName: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    return;
  }

  await markRunning(job.id, WORKER_ID, prisma);

  const ctx = {
    jobId: job.id,
    tenantId: job.tenantId,
    prisma,
    log: {
      info: (msg: string) => console.log(`[${jobId}] ${msg}`),
      warn: (msg: string) => console.warn(`[${jobId}] ${msg}`),
      error: (msg: string) => console.error(`[${jobId}] ${msg}`),
    },
  };

  try {
    const handler = HANDLERS[job.type];
    if (!handler) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    const result = await handler(job.payload as Record<string, unknown>, ctx);
    await markCompleted(job.id, result, prisma);

    console.log(`Priority job ${jobId} completed`);
  } catch (err: any) {
    await markFailed(job.id, err.message, prisma);
    console.error(`Priority job ${jobId} failed:`, err.message);
  }
  // no finally/XACK block — there is no Redis Stream message for priority jobs
}

// Why no finally/XACK — XACK only makes sense for messages that came through XADD/XREADGROUP. A priority job never entered the stream, so there's nothing to acknowledge. Trying to XACK a message ID that doesn't exist would just be a wasted no-op call.

async function createConsumerGroups() {
  for (const queue of QUEUES) {
    try {
      await redis.xgroup('CREATE', `queue:${queue}:stream`, 'workers', '0', 'MKSTREAM');
      console.log(`Consumer group created for queue: ${queue}`);
    } catch (err: any) {
      if (err.message.includes('BUSYGROUP')) {
        console.log(`Consumer group already exists for queue: ${queue}`);
      } else {
        throw err;
      }
    }
  }
}

async function poll() {
  while (true) {
    for (const queue of QUEUES) {
      
       // check priority queue FIRST, before normal stream polling
      const priorityResult = await redis.zpopmax(`queue:${queue}:priority`, 1);

      if (priorityResult.length > 0) {
        const jobId = priorityResult[0];
        console.log(`Picked up PRIORITY job ${jobId} from queue ${queue}`);
        await executePriorityJob(jobId, queue);
        continue; // skip the normal XREADGROUP this iteration
      }

      // Why zpopmax runs first, every iteration — this guarantees priority jobs always jump the queue. Even if there are 50 normal jobs already sitting in the stream, the moment a priority job is pushed to the sorted set, the very next loop iteration picks it up before touching the stream.
      
      const results = await redis.xreadgroup(
        'GROUP', 'workers', WORKER_ID,
        'COUNT', '1',
        'BLOCK', '5000',
        'STREAMS', `queue:${queue}:stream`, '>'
      );

      if (!results) continue;

      for (const [, messages] of results) {
        for (const [messageId, fields] of messages) {
          const jobId = fields[fields.indexOf('jobId') + 1];
          console.log(`Picked up job ${jobId} from queue ${queue}`);
          
          // execute the job (Stage 4)
          await executeJob(jobId, messageId, queue);
        }
      }
    }
  }
}


async function executeJob(jobId: string, messageId: string, queueName: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    await redis.xack(`queue:${queueName}:stream`, 'workers', messageId);
    return;
  }

  // await prisma.job.update({
  //   where: { id: jobId },
  //   data: { status: 'RUNNING', startedAt: new Date() },
  // });
  await markRunning(job.id, WORKER_ID, prisma);

  const ctx = {
    jobId: job.id,
    tenantId: job.tenantId,
    prisma,
    log: {
      info: (msg: string) => console.log(`[${jobId}] ${msg}`),
      warn: (msg: string) => console.warn(`[${jobId}] ${msg}`),
      error: (msg: string) => console.error(`[${jobId}] ${msg}`),
    },
  };

  try {
    const handler = HANDLERS[job.type];
    if (!handler) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    const result = await handler(job.payload as Record<string, unknown>, ctx);

    // await prisma.job.update({
    //   where: { id: jobId },
    //   data: { status: 'COMPLETED', completedAt: new Date(), result: result as object },
    // });
    await markCompleted(job.id, result, prisma);

    console.log(`Job ${jobId} completed`);
  } catch (err: any) {
    // await prisma.job.update({
    //   where: { id: jobId },
    //   data: { status: 'FAILED', failedAt: new Date(), error: err.message },
    // });
    await markFailed(job.id, err.message, prisma);

    console.error(`Job ${jobId} failed:`, err.message);
  } finally {
    await redis.xack(`queue:${queueName}:stream`, 'workers', messageId);
  }
}

async function start() {
  // register this worker in the database
  await prisma.worker.create({
    data: {
      hostname: os.hostname(),
      pid: process.pid,
      queues: QUEUES,
      status: 'active',
    },
  });

  console.log(`Worker ${WORKER_ID} started, listening on queues: ${QUEUES}`);

   // 2. create consumer groups in Redis
  await createConsumerGroups();

  // 3. start polling loop
  await poll();
}

start().catch(console.error);



// We built a background worker — a separate program that runs alongside the API and does the actual work. Think of it like a restaurant kitchen. The API is the front-of-house staff taking orders from customers and writing them on tickets. The Redis Stream is the ticket rail where orders hang waiting to be picked up. The worker is the chef who stands at that rail, grabs a ticket, cooks the meal, and marks it done. The chef does not care how the order arrived or who placed it — they just keep pulling tickets and executing them one by one. When there are no tickets, the chef waits. When a new one arrives, they immediately get to work. We proved this entire flow works — a job submitted through the API appeared on the ticket rail and the worker picked it up and completed it within seconds.


// We implemented a distributed job consumer using Redis Streams with consumer groups. The worker process (apps/worker/src/worker.ts) is a standalone Node.js process — not a NestJS application — that bootstraps its own PrismaClient instance using the @prisma/adapter-pg driver adapter (required by Prisma 7) and an ioredis connection, both reading from environment variables via dotenv. On startup, the worker registers itself in the PostgreSQL workers table with its hostname, PID, and assigned queues — establishing a presence that the stalled job detector in Phase 2 will use to detect dead workers via heartbeat staleness. It then calls XGROUP CREATE queue:{name}:stream workers 0 MKSTREAM for each queue it handles, creating a Redis consumer group named workers with offset 0 (read from beginning) and MKSTREAM to create the stream if absent — catching and suppressing the BUSYGROUP error on subsequent restarts since the group already exists. The main polling loop calls XREADGROUP GROUP workers {workerId} COUNT 1 BLOCK 5000 STREAMS queue:{name}:stream > — the > special ID requests only messages not yet delivered to any consumer in the group, the BLOCK 5000 parks the connection for up to 5 seconds awaiting new messages rather than busy-polling. On message receipt, the worker extracts the jobId from the message fields, fetches the full job record from PostgreSQL, transitions it to RUNNING status with startedAt, dispatches to the handler registry by job.type, and on completion transitions to COMPLETED with completedAt and result data. A finally block unconditionally calls XACK queue:{name}:stream workers {messageId} to remove the message from the Pending Entry List — the absence of this ACK is what Phase 2's stalled job detector will use to identify messages claimed by crashed workers and reclaim them via XCLAIM.
