import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as crypto from 'crypto';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const rawKey = 'qf_test_key_123';
  const apiKeyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const tenant = await prisma.tenant.upsert({
    where: { apiKeyHash },
    update: {},
    create: {
      name: 'Test Tenant',
      apiKeyHash,
      plan: 'free',
      rateLimitRps: 10,
      maxWorkers: 2,
      isActive: true,
    },
  });

  console.log('Created tenant:', tenant.id);

  const queue = await prisma.queue.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'default' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'default',
      concurrency: 5,
      maxAttempts: 3,
      backoffType: 'exponential',
      backoffDelayMs: 1000,
    },
  });

  console.log('Created queue:', queue.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());