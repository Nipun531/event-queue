import {Controller, Get} from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  findAll(): {status: string, timestamp: string} {
    return {status: 'OK',timestamp: new Date().toISOString()};
  }
}