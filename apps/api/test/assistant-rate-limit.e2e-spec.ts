import type { INestApplication } from '@nestjs/common';
import {
  Test,
  type TestingModule,
} from '@nestjs/testing';
import {
  createHash,
  randomBytes,
} from 'node:crypto';
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
import { PrismaService } from '../src/database/prisma.service.js';

describe('Assistant rate limiting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const uniqueId = randomBytes(8).toString('hex');

  const emails = [
    `assistant-limit-a-${uniqueId}@blx.local`,
    `assistant-limit-b-${uniqueId}@blx.local`,
  ];

  const cookies: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);

    prisma = moduleFixture.get<PrismaService>(
      PrismaService,
    );

    await app.init();

    for (const email of emails) {
      const user = await prisma.user.create({
        data: {
          fullName: 'Assistant Security Test',
          email,
          passwordHash: 'unused-test-password-hash',
          emailVerifiedAt: new Date(),
        },
      });

      const token = randomBytes(32).toString('hex');

      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: createHash('sha256')
            .update(token)
            .digest('hex'),
          expiresAt: new Date(
            Date.now() + 60 * 60 * 1000,
          ),
        },
      });

      cookies.push(`blx_session=${token}`);
    }
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: emails,
          },
        },
      });
    }

    if (app) {
      await app.close();
    }
  });

  function invalidChatRequest(cookie: string) {
    return request(app.getHttpServer())
      .post('/api/assistant/chat')
      .set('Cookie', cookie)
      .send({
        unexpectedSecurityTestField: true,
      });
  }

  it('limits an authenticated user to ten requests per minute', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await invalidChatRequest(cookies[0]).expect(400);
    }

    const response = await invalidChatRequest(
      cookies[0],
    ).expect(429);

    expect(response.body.statusCode).toBe(429);
  });

  it('does not share the limit between authenticated users', async () => {
    await invalidChatRequest(cookies[1]).expect(400);
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer())
      .post('/api/assistant/chat')
      .send({
        unexpectedSecurityTestField: true,
      })
      .expect(401);
  });
});
