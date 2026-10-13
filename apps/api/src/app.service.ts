import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'blx-store-api',
      timestamp: new Date().toISOString(),
    };
  }
}
