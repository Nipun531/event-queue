import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateJobDto, CreateJobSchema, ListJobsQueryDto, ListJobsQuerySchema } from "@event-queue/shared-types";
import Redis from "ioredis";

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async createJob(dto: CreateJobDto) {
    const result = CreateJobSchema.safeParse(dto);
    if (!result.success) {
      throw new BadRequestException(
        result.error.issues[0]?.message ?? 'Validation failed'
      );
    }

    const tenant = await this.prisma.db.tenant.findFirst({
      where: { name: 'Test Tenant' },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const queue = await this.prisma.db.queue.findUnique({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: dto.queue,
        },
      },
    });
    if (!queue) throw new NotFoundException(`Queue "${dto.queue}" not found`);

    const job = await this.prisma.db.job.create({
      data: {
        queueId: queue.id,
        tenantId: tenant.id,
        type: dto.type,
        payload: (dto.payload ?? {}) as object,
        status: 'PENDING',
        priority: dto.priority ?? 0,
        runAt: dto.runAt ? new Date(dto.runAt) : new Date(),
        maxAttempts: dto.maxAttempts ?? queue.maxAttempts ?? 3,
      },
    });

    const isScheduled = dto.runAt && new Date(dto.runAt) > new Date();
    if (isScheduled) {
    // future job — park it in the scheduled sorted set, do NOT push to stream/priority yet
    const runAtMs = new Date(dto.runAt!).getTime();
    await this.redis.zadd('queue:scheduled', runAtMs, JSON.stringify({ jobId: job.id, queue: dto.queue }));
  } else {
      const priority = dto.priority ?? 0;

    if (priority > 0) {
      // high-priority job — goes into the sorted set, NOT the stream(zadd for set xadd for stream)
      await this.redis.zadd(`queue:${dto.queue}:priority`, priority, job.id);
    } else {
      // normal priority — goes into the stream as usual
      await this.redis.xadd(
        `queue:${dto.queue}:stream`,
        '*',
        'jobId', job.id
      );
    }
    }

    return { jobId: job.id, status: 'PENDING' };
  }

  async findAll(query: ListJobsQueryDto) {
  const parsed = ListJobsQuerySchema.parse({
    status: query.status,
    queue: query.queue,
    type: query.type,
    page: query.page,
    limit: query.limit,
  });

  const tenant = await this.prisma.db.tenant.findFirst({
    where: { name: 'Test Tenant' },
  });
  if (!tenant) throw new NotFoundException('Tenant not found');

  const where: any = { tenantId: tenant.id };
  if (parsed.status) where.status = parsed.status;
  if (parsed.type) where.type = parsed.type;
  if (parsed.queue) {
    const queueRow = await this.prisma.db.queue.findUnique({
      where: { tenantId_name: { tenantId: tenant.id, name: parsed.queue } },
    });
    if (queueRow) where.queueId = queueRow.id;
  }

  const skip = (parsed.page - 1) * parsed.limit;

  const [data, total] = await Promise.all([
    this.prisma.db.job.findMany({
      where,
      skip,
      take: parsed.limit,
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.db.job.count({ where }),
  ]);

  return { data, total, page: parsed.page, limit: parsed.limit };
}

  async findOne(id: string) {
    const job = await this.prisma.db.job.findUnique({
      where: { id },
      include: {
        logs: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!job) throw new NotFoundException(`Job ${id} not found`);

    const durationMs =
      job.startedAt && job.completedAt
        ? job.completedAt.getTime() - job.startedAt.getTime()
        : null;

    return { ...job, durationMs };
  }

  async retry(id: string) {
    const job = await this.prisma.db.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`Job ${id} not found`);

    if (job.status !== 'FAILED' && job.status !== 'DEAD') {
      throw new ConflictException(
        `Job ${id} cannot be retried — current status is ${job.status}`
      );
    }

    const queue = await this.prisma.db.queue.findUnique({ where: { id: job.queueId } });
    if (!queue) throw new NotFoundException('Queue not found for this job');

    const updated = await this.prisma.db.job.update({
      where: { id },
      data: {
        status: 'PENDING',
        attempts: 0,
        error: null,
        startedAt: null,
        completedAt: null,
        failedAt: null,
      },
    });

    await this.redis.xadd(
      `queue:${queue.name}:stream`,
      '*',
      'jobId', job.id
    );

    return updated;
  }

  async cancel(id: string) {
    const job = await this.prisma.db.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`Job ${id} not found`);

    if (job.status !== 'PENDING') {
      throw new ConflictException(
        `Job ${id} cannot be cancelled — current status is ${job.status}`
      );
    }

    return this.prisma.db.job.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}