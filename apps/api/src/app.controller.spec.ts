import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AppController } from './app.controller.js';
import {
  AppService,
  type HealthResponse,
  type LivenessResponse,
} from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  const healthResponse: HealthResponse = {
    status: 'ok',
    service: 'blx-store-api',
    database: 'ok',
    timestamp: '2026-10-13T00:00:00.000Z',
  };

  const livenessResponse: LivenessResponse = {
    status: 'ok',
    service: 'blx-store-api',
    timestamp: '2026-10-13T00:00:00.000Z',
  };

  const appServiceMock = {
    getHealth: vi.fn(),
    getLiveness: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    appServiceMock.getHealth.mockResolvedValue(
      healthResponse,
    );

    appServiceMock.getLiveness.mockReturnValue(
      livenessResponse,
    );

    const app: TestingModule =
      await Test.createTestingModule({
        controllers: [AppController],
        providers: [
          {
            provide: AppService,
            useValue: appServiceMock,
          },
        ],
      }).compile();

    appController =
      app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('returns the existing health response', async () => {
      await expect(
        appController.getHealth(),
      ).resolves.toEqual(healthResponse);

      expect(
        appServiceMock.getHealth,
      ).toHaveBeenCalledOnce();
    });

    it('returns liveness without a database check', () => {
      expect(
        appController.getLiveness(),
      ).toEqual(livenessResponse);

      expect(
        appServiceMock.getLiveness,
      ).toHaveBeenCalledOnce();

      expect(
        appServiceMock.getHealth,
      ).not.toHaveBeenCalled();
    });

    it('returns readiness using the database health check', async () => {
      await expect(
        appController.getReadiness(),
      ).resolves.toEqual(healthResponse);

      expect(
        appServiceMock.getHealth,
      ).toHaveBeenCalledOnce();
    });
  });
});
