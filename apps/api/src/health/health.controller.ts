import {Controller, Get,Inject} from '@nestjs/common';

@Controller('health')
export class HealthController {

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redisClient: any) {}

  @Get()
  async check(){
    const pong=await this.redisClient.ping();
    return {status: 'OK',timestamp: new Date().toISOString(), redis: pong};
  }
}

// What ping() does
// ping() is the simplest Redis command. It sends the word PING to Redis and Redis responds with PONG. That's it. It's a heartbeat — just proving the connection is alive. Like calling someone on the phone and saying "can you hear me?" and they say "yes".

// What's happening under the hood when you inject Redis
// When NestJS boots AppModule, it sees RedisModule is imported.
//  RedisModule's useFactory runs — it creates a new ioredis connection to REDIS_URL.
//  That connection object gets registered under the token REDIS_CLIENT.
//  When HealthController is created, NestJS sees @Inject('REDIS_CLIENT') in the constructor and hands it that same connection object.
//  You now have a live Redis connection inside your controller.
// You did not create the Redis connection. You did not manage its lifecycle. NestJS handled all of that. That is the point of dependency injection.