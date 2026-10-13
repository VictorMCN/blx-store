import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from './app.controller.js';
import { AppService, type HealthResponse } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  const healthResponse: HealthResponse = {
    status: 'ok',
    service: 'blx-store-api',
    database: 'ok',
    timestamp: '2026-10-13T00:00:00.000Z',
  };

  const appServiceMock = {
    getHealth: vi.fn(),
  };

  beforeEach(async () => {
    appServiceMock.getHealth.mockResolvedValue(healthResponse);

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: appServiceMock,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return the API health status', async () => {
      await expect(appController.getHealth()).resolves.toEqual(healthResponse);
    });
  });
});
