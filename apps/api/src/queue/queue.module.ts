import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { QueuesService } from './queue.service';

@Module({
  imports: [PrismaModule],
  controllers: [QueueController],
  providers: [QueuesService],
})
export class QueuesModule {}