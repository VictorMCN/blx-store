import {
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { PrismaService } from './database/prisma.service.js';
import { AppService } from './app.service.js';

describe('AppService', () => {
  const queryRawMock = vi.fn();

  const prisma = {
    $queryRaw: queryRawMock,
  } as unknown as PrismaService;

  const service = new AppService(prisma);

  beforeEach(() => {
    queryRawMock.mockReset();
  });

  it('reports liveness without querying PostgreSQL', () => {
    const result = service.getLiveness();

    expect(result).toEqual({
      status: 'ok',
      service: 'blx-store-api',
      timestamp: expect.any(String),
    });

    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it('reports readiness when PostgreSQL responds', async () => {
    queryRawMock.mockResolvedValue([{ result: 1 }]);

    await expect(
      service.getHealth(),
    ).resolves.toEqual({
      status: 'ok',
      service: 'blx-store-api',
      database: 'ok',
      timestamp: expect.any(String),
    });

    expect(queryRawMock).toHaveBeenCalledOnce();
  });

  it('returns HTTP 503 when PostgreSQL is unavailable', async () => {
    queryRawMock.mockRejectedValue(
      new Error('Simulated database failure'),
    );

    await expect(
      service.getHealth(),
    ).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(queryRawMock).toHaveBeenCalledOnce();
  });

  it('does not expose database errors to the client', async () => {
    queryRawMock.mockRejectedValue(
      new Error('Sensitive database connection information'),
    );

    try {
      await service.getHealth();
      throw new Error('Expected health check to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(
        ServiceUnavailableException,
      );

      if (error instanceof ServiceUnavailableException) {
        expect(error.getStatus()).toBe(503);
        expect(error.message).toBe(
          'Database is unavailable.',
        );

        expect(error.message).not.toContain(
          'Sensitive database connection information',
        );
      }
    }
  });
});
