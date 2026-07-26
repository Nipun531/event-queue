import { Module } from '@nestjs/common';
import * as Joi from 'joi';
import {ConfigModule} from "@nestjs/config";
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis.module';
import { QueuesModule } from './queue/queue.module';
import { JobsModule } from './jobs/jobs.module';
import { ScheduleModule } from '@nestjs/schedule/dist/schedule.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        PORT: Joi.number().default(3000),
      }),
    }),
    ScheduleModule.forRoot(),
    HealthModule,
    QueuesModule,
    JobsModule,
    RedisModule,
    SchedulerModule,
    // PrismaModule
  ],
  
})
export class AppModule {}
