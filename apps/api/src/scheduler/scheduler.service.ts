import { Injectable, Inject } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import Redis from 'ioredis';

@Injectable()
export class SchedulerService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  @Interval(5000)
  async releaseDueJobs() {
    const now = Date.now();

    const dueJobs = await this.redis.zrangebyscore('queue:scheduled', 0, now, 'LIMIT', 0, 50);

    if (dueJobs.length === 0) return;

    for (const raw of dueJobs) {
      interface ScheduledJobRef {
        jobId: string;
        queue: string;
      }

      const { jobId, queue }: ScheduledJobRef = JSON.parse(raw);

      await this.redis.xadd(`queue:${queue}:stream`, '*', 'jobId', jobId);
      await this.redis.zrem('queue:scheduled', raw);

      console.log(`Released scheduled job ${jobId} into queue ${queue}`);
    }
  }
}