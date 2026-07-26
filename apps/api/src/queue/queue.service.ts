import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQueueDto, CreateQueueSchema } from '@event-queue/shared-types';

@Injectable()
export class QueuesService {
  constructor(private readonly prisma: PrismaService) {}

async create(dto: CreateQueueDto) {
  const result = CreateQueueSchema.safeParse(dto);
 if (!result.success) {
  throw new BadRequestException(
    result.error.issues[0]?.message ?? 'Validation failed'
  );
}
  
  const tenant = await this.prisma.db.tenant.findFirst({
    where: { name: 'Test Tenant' },
  });

  if (!tenant) throw new NotFoundException('Test tenant not found');

  const existing = await this.prisma.db.queue.findUnique({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: dto.name,
      },
    },
  });

  if (existing) {
    throw new ConflictException(`Queue "${dto.name}" already exists`);
  }

  return this.prisma.db.queue.create({
    data: {
      tenantId: tenant.id,
      name: dto.name,
      concurrency: dto.concurrency ?? 5,
      maxAttempts: dto.maxAttempts ?? 3,
      backoffType: dto.backoffType ?? 'exponential',
      backoffDelayMs: dto.backoffDelayMs ?? 1000,
    },
  });
}

 async findAll() {
  const queues = await this.prisma.db.queue.findMany();
  
  return Promise.all(
    queues.map(async (queue) => {
      const depth = await this.prisma.db.job.count({
        where: { queueId: queue.id, status: 'PENDING' },
      });
      return { ...queue, depth };
    })
  );
}

  async findOne(id: string) {
    const queue = await this.prisma.db.queue.findUnique({
      where: { id },
    });
    if (!queue) throw new NotFoundException(`Queue ${id} not found`);
    
    const depth = await this.prisma.db.job.count({
      where: { queueId: id, status: 'PENDING' },
    });
    
    return { ...queue, depth };
  }
}