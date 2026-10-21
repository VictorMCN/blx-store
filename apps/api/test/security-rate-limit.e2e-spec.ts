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

describe('Authentication rate limiting (e2e)', () => {
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

  it('limits repeated login attempts', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'unknown.rate-limit@blx.local',
          password: 'incorrect-password',
        })
        .expect(401);
    }

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'unknown.rate-limit@blx.local',
        password: 'incorrect-password',
      })
      .expect(429);

    expect(response.body.statusCode).toBe(429);
  });

  it('limits repeated registration attempts', async () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
        })
        .expect(400);
    }

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'invalid-email',
      })
      .expect(429);
  });

  it('limits repeated verification resend requests', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await request(app.getHttpServer())
        .post('/api/auth/resend-verification')
        .send({})
        .expect(400);
    }

    await request(app.getHttpServer())
      .post('/api/auth/resend-verification')
      .send({})
      .expect(429);
  });
});
