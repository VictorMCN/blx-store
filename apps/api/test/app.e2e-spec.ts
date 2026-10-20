import type { INestApplication } from '@nestjs/common';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    configureApp(app);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/health (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'blx-store-api',
      database: 'ok',
      timestamp: expect.any(String),
    });

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it('/api/health/live (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health/live')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'blx-store-api',
      timestamp: expect.any(String),
    });

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it('/api/health/ready (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health/ready')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'blx-store-api',
      database: 'ok',
      timestamp: expect.any(String),
    });

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });

  it('adds a request ID to unmatched routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/nonexistent-monitoring-route')
      .expect(404);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f-]{36}$/,
    );
  });
});
