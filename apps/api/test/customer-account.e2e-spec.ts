import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/database/prisma.service.js';

function generateCpf(seed: number): string {
  const base = String(seed % 1_000_000_000)
    .padStart(9, '0')
    .split('')
    .map(Number);

  if (new Set(base).size === 1) {
    base[8] = (base[8] + 1) % 10;
  }

  const calculateDigit = (
    digits: number[],
  ): number => {
    const weightStart =
      digits.length + 1;

    const sum = digits.reduce(
      (total, digit, index) =>
        total +
        digit *
          (weightStart - index),
      0,
    );

    const remainder =
      (sum * 10) % 11;

    return remainder === 10
      ? 0
      : remainder;
  };

  const firstDigit =
    calculateDigit(base);

  const secondDigit =
    calculateDigit([
      ...base,
      firstDigit,
    ]);

  return [
    ...base,
    firstDigit,
    secondDigit,
  ].join('');
}

function generateCnpj(
  seed: number,
): string {
  const root = String(
    seed % 100_000_000,
  )
    .padStart(8, '0')
    .split('')
    .map(Number);

  const base = [
    ...root,
    0,
    0,
    0,
    1,
  ];

  const calculateDigit = (
    digits: number[],
    weights: number[],
  ): number => {
    const sum = digits.reduce(
      (
        total,
        digit,
        index,
      ) =>
        total +
        digit *
          weights[index],
      0,
    );

    const remainder =
      sum % 11;

    return remainder < 2
      ? 0
      : 11 - remainder;
  };

  const firstDigit =
    calculateDigit(
      base,
      [
        5, 4, 3, 2, 9, 8,
        7, 6, 5, 4, 3, 2,
      ],
    );

  const secondDigit =
    calculateDigit(
      [
        ...base,
        firstDigit,
      ],
      [
        6, 5, 4, 3, 2, 9,
        8, 7, 6, 5, 4, 3,
        2,
      ],
    );

  return [
    ...base,
    firstDigit,
    secondDigit,
  ].join('');
}

describe(
  'Customer account profile (e2e)',
  () => {
    let app:
      INestApplication;

    let prisma:
      PrismaService;

    let sessionCookie:
      string;

    let secondSessionCookie:
      string;

    const uniqueId =
      Date.now();

    const email =
      `profile.e2e.${uniqueId}@blx.local`;

    const secondEmail =
      `profile.second.e2e.${uniqueId}@blx.local`;

    const password =
      'BLX-e2e-password-123';

    const cpf =
      generateCpf(uniqueId);

    const cnpj =
      generateCnpj(uniqueId);

    beforeAll(async () => {
      const moduleFixture:
        TestingModule =
        await Test.createTestingModule({
          imports: [
            AppModule,
          ],
        }).compile();

      app =
        moduleFixture.createNestApplication();

      configureApp(app);

      prisma =
        moduleFixture.get<PrismaService>(
          PrismaService,
        );

      await app.init();

      await request(
        app.getHttpServer(),
      )
        .post(
          '/api/auth/register',
        )
        .send({
          fullName:
            'Test Customer',
          email,
          password,
        })
        .expect(201);

      await request(
        app.getHttpServer(),
      )
        .post(
          '/api/auth/register',
        )
        .send({
          fullName:
            'Second Test Customer',
          email:
            secondEmail,
          password,
        })
        .expect(201);

      const loginResponse =
        await request(
          app.getHttpServer(),
        )
          .post(
            '/api/auth/login',
          )
          .send({
            email,
            password,
          })
          .expect(200);

      const secondLoginResponse =
        await request(
          app.getHttpServer(),
        )
          .post(
            '/api/auth/login',
          )
          .send({
            email:
              secondEmail,
            password,
          })
          .expect(200);

      const firstCookie =
        loginResponse
          .headers[
            'set-cookie'
          ];

      const secondCookie =
        secondLoginResponse
          .headers[
            'set-cookie'
          ];

      sessionCookie = (
        Array.isArray(
          firstCookie,
        )
          ? firstCookie[0]
          : firstCookie
      ).split(';')[0];

      secondSessionCookie =
        (
          Array.isArray(
            secondCookie,
          )
            ? secondCookie[0]
            : secondCookie
        ).split(';')[0];
    });

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              email,
              secondEmail,
            ],
          },
        },
      });

      await app.close();
    });

    it(
      'returns null before a profile exists',
      async () => {
        const response =
          await request(
            app.getHttpServer(),
          )
            .get(
              '/api/account/profile',
            )
            .set(
              'Cookie',
              sessionCookie,
            )
            .expect(200);

        expect(
          response.body,
        ).toEqual({
          profile: null,
        });
      },
    );

    it(
      'rejects profile access without authentication',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .get(
            '/api/account/profile',
          )
          .expect(401);
      },
    );

    it(
      'uses the authenticated account name and normalizes individual profile data',
      async () => {
        const response =
          await request(
            app.getHttpServer(),
          )
            .put(
              '/api/account/profile',
            )
            .set(
              'Cookie',
              sessionCookie,
            )
            .send({
              accountType:
                'INDIVIDUAL',

              /*
               * The server must ignore
               * profile-supplied names
               * and use User.fullName.
               */
              fullName:
                'Spoofed Profile Name',

              taxId:
                cpf,

              phone:
                '(61) 99999-0000',
            })
            .expect(200);

        expect(
          response.body,
        ).toMatchObject({
          profile: {
            accountType:
              'INDIVIDUAL',

            fullName:
              'Test Customer',

            legalName:
              null,

            tradeName:
              null,

            phone:
              '61999990000',
          },
        });

        expect(
          response.body
            .profile
            .taxIdMasked,
        ).toBe(
          `${'*'.repeat(
            cpf.length - 4,
          )}${cpf.slice(-4)}`,
        );

        expect(
          response.body
            .profile,
        ).not.toHaveProperty(
          'taxId',
        );

        const storedProfile =
          await prisma
            .customerProfile
            .findUnique({
              where: {
                taxId:
                  cpf,
              },
            });

        expect(
          storedProfile,
        ).not.toBeNull();

        expect(
          storedProfile
            ?.fullName,
        ).toBe(
          'Test Customer',
        );
      },
    );

    it(
      'rejects an invalid CPF',
      async () => {
        const response =
          await request(
            app.getHttpServer(),
          )
            .put(
              '/api/account/profile',
            )
            .set(
              'Cookie',
              sessionCookie,
            )
            .send({
              accountType:
                'INDIVIDUAL',

              taxId:
                '000.000.000-00',
            })
            .expect(400);

        expect(
          response.body,
        ).toMatchObject({
          statusCode: 400,
          message:
            'A valid CPF is required for individual accounts.',
        });
      },
    );

    it(
      'uses the account name when an individual profile payload omits fullName',
      async () => {
        const response =
          await request(
            app.getHttpServer(),
          )
            .put(
              '/api/account/profile',
            )
            .set(
              'Cookie',
              sessionCookie,
            )
            .send({
              accountType:
                'INDIVIDUAL',

              taxId:
                cpf,
            })
            .expect(200);

        expect(
          response.body,
        ).toMatchObject({
          profile: {
            accountType:
              'INDIVIDUAL',

            fullName:
              'Test Customer',
          },
        });
      },
    );

    it(
      'can change the profile to a business account',
      async () => {
        const response =
          await request(
            app.getHttpServer(),
          )
            .put(
              '/api/account/profile',
            )
            .set(
              'Cookie',
              sessionCookie,
            )
            .send({
              accountType:
                'BUSINESS',

              legalName:
                'BLX Demo Commerce Ltd.',

              tradeName:
                'BLX Demo',

              taxId:
                cnpj,

              phone:
                '+55 (61) 3333-0000',
            })
            .expect(200);

        expect(
          response.body,
        ).toMatchObject({
          profile: {
            accountType:
              'BUSINESS',

            fullName:
              null,

            legalName:
              'BLX Demo Commerce Ltd.',

            tradeName:
              'BLX Demo',

            phone:
              '556133330000',
          },
        });

        expect(
          response.body
            .profile
            .taxIdMasked,
        ).toBe(
          `${'*'.repeat(
            cnpj.length - 4,
          )}${cnpj.slice(-4)}`,
        );
      },
    );

    it(
      'rejects an invalid CNPJ',
      async () => {
        const response =
          await request(
            app.getHttpServer(),
          )
            .put(
              '/api/account/profile',
            )
            .set(
              'Cookie',
              sessionCookie,
            )
            .send({
              accountType:
                'BUSINESS',

              legalName:
                'Invalid Company Ltd.',

              taxId:
                '00.000.000/0000-00',
            })
            .expect(400);

        expect(
          response.body,
        ).toMatchObject({
          statusCode: 400,
          message:
            'A valid CNPJ is required for business accounts.',
        });
      },
    );

    it(
      'requires a legal name for business accounts',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .put(
            '/api/account/profile',
          )
          .set(
            'Cookie',
            sessionCookie,
          )
          .send({
            accountType:
              'BUSINESS',

            taxId:
              cnpj,
          })
          .expect(400);
      },
    );

    it(
      'prevents another customer from using the same tax ID',
      async () => {
        const response =
          await request(
            app.getHttpServer(),
          )
            .put(
              '/api/account/profile',
            )
            .set(
              'Cookie',
              secondSessionCookie,
            )
            .send({
              accountType:
                'BUSINESS',

              legalName:
                'Another Demo Company Ltd.',

              taxId:
                cnpj,
            })
            .expect(409);

        expect(
          response.body,
        ).toMatchObject({
          statusCode:
            409,

          message:
            'This tax ID is already in use.',
        });
      },
    );

    it(
      'rejects undeclared profile fields',
      async () => {
        await request(
          app.getHttpServer(),
        )
          .put(
            '/api/account/profile',
          )
          .set(
            'Cookie',
            sessionCookie,
          )
          .send({
            accountType:
              'BUSINESS',

            legalName:
              'BLX Demo Commerce Ltd.',

            taxId:
              cnpj,

            role:
              'ADMIN',
          })
          .expect(400);
      },
    );
  },
);
