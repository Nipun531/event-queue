import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { RedisModule } from 'src/redis.module';

@Module({
  imports: [RedisModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}