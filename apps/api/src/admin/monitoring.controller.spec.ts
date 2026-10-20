import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { PrismaService } from '../database/prisma.service.js';
import { MonitoringController } from './monitoring.controller.js';

describe('MonitoringController', () => {
  const queryRaw = vi.fn();

  const prisma = {
    $queryRaw: queryRaw,
  } as unknown as PrismaService;

  const controller = new MonitoringController(prisma);

  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('returns real service status and metric histories', async () => {
    queryRaw.mockResolvedValue([{ result: 1 }]);

    const response = await controller.getMonitoring();

    expect(response).toMatchObject({
      service: 'blx-store-api',
      health: {
        api: 'ok',
        database: 'ok',
      },
      retention: {
        type: 'memory',
        intervalSeconds: 60,
        maxSnapshotsPerCategory: 30,
      },
      http: {
        history: expect.any(Array),
      },
      ai: {
        history: expect.any(Array),
      },
      payments: {
        history: expect.any(Array),
      },
    });

    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it('reports database unavailability without exposing errors', async () => {
    queryRaw.mockRejectedValue(
      new Error('SECRET_DATABASE_CONNECTION_DETAILS'),
    );

    const response = await controller.getMonitoring();

    expect(response.health).toEqual({
      api: 'ok',
      database: 'unavailable',
    });

    expect(JSON.stringify(response)).not.toContain(
      'SECRET_DATABASE_CONNECTION_DETAILS',
    );
  });
});
