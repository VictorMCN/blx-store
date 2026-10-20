import {
  Controller,
  Get,
} from '@nestjs/common';
import {
  AppService,
  type HealthResponse,
  type LivenessResponse,
} from './app.service.js';

@Controller('health')
export class AppController {
  constructor(
    private readonly appService: AppService,
  ) {}

  @Get()
  getHealth(): Promise<HealthResponse> {
    return this.appService.getHealth();
  }

  @Get('live')
  getLiveness(): LivenessResponse {
    return this.appService.getLiveness();
  }

  @Get('ready')
  getReadiness(): Promise<HealthResponse> {
    return this.appService.getHealth();
  }
}
