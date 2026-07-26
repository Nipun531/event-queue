import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redis = new Redis(configService.get<string>('REDIS_URL')!);

        redis.on('ready', () => {
          console.log('Redis connected successfully');
        });

        redis.on('error', (err) => {
          console.error('Redis connection error:', err);
        });

        return redis;
      },
      inject: [ConfigService],
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}