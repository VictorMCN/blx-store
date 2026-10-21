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
  it,
} from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('Request origin protection (e2e)', () => {
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

  it('rejects state-changing requests from an external origin', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', 'https://attacker.example')
      .expect(403);
  });

  it('accepts the configured frontend origin', async () => {
    const trustedOrigin = new URL(
      process.env.APP_URL ??
        'http://localhost:3000',
    ).origin;

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', trustedOrigin)
      .expect(204);
  });

  it('rejects browser requests marked as cross-site', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403);
  });

  it('does not block public GET requests', async () => {
    await request(app.getHttpServer())
      .get('/api/health/live')
      .set('Origin', 'https://attacker.example')
      .expect(200);
  });

  it('accepts the local Next.js development proxy', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', 'https://localhost:3000')
      .set('Sec-Fetch-Site', 'same-origin')
      .expect(204);
  });

  it('rejects cross-site requests using the proxy origin', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', 'https://localhost:3000')
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403);
  });

  it('rejects unrelated origins even when marked same-origin', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', 'https://attacker.example')
      .set('Sec-Fetch-Site', 'same-origin')
      .expect(403);
  });
});
