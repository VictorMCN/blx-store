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

describe('Authentication rate limit isolation (e2e)', () => {
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

  const cases = [
    {
      path: '/api/auth/login',
      limit: 10,
      name: 'login',
    },
    {
      path: '/api/auth/register',
      limit: 20,
      name: 'register',
    },
    {
      path: '/api/auth/resend-verification',
      limit: 5,
      name: 'resend verification',
    },
  ];

  for (const testCase of cases) {
    it(`isolates ${testCase.name} limits by email`, async () => {
      const primaryEmail =
        `${testCase.name.replaceAll(' ', '-')}-primary@example.test`;

      const secondaryEmail =
        `${testCase.name.replaceAll(' ', '-')}-secondary@example.test`;

      const sendInvalidRequest = (email: string) =>
        request(app.getHttpServer())
          .post(testCase.path)
          .send({
            email,
            securityProbe: true,
          });

      for (let attempt = 0; attempt < testCase.limit; attempt++) {
        const response =
          await sendInvalidRequest(primaryEmail);

        expect(response.status).toBe(400);
      }

      const blockedResponse =
        await sendInvalidRequest(primaryEmail);

      expect(blockedResponse.status).toBe(429);

      const independentResponse =
        await sendInvalidRequest(secondaryEmail);

      expect(independentResponse.status).toBe(400);
    });
  }
});
