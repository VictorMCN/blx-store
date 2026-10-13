import { Controller, Get } from '@nestjs/common';
import { AppService, type HealthResponse } from './app.service.js';

@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): Promise<HealthResponse> {
    return this.appService.getHealth();
  }
}
