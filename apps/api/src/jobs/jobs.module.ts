import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JobsService } from './jobs.service';
import { RedisModule } from 'src/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}