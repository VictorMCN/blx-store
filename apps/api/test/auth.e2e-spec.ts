import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const uniqueId = Date.now();
  const rawEmail = `AUTH.E2E.${uniqueId}@BLX.LOCAL`;
  const normalizedEmail = rawEmail.toLowerCase();
  const attackerEmail = `attacker.e2e.${uniqueId}@blx.local`;
  const unknownEmail = `unknown.e2e.${uniqueId}@blx.local`;
  const password = 'BLX-e2e-password-123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [normalizedEmail, attackerEmail, unknownEmail],
        },
      },
    });

    await app.close();
  });

  it('registers a customer with a hashed password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: rawEmail,
        password,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      user: {
        email: normalizedEmail,
        role: 'CUSTOMER',
      },
    });

    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user).toHaveProperty('createdAt');
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');

    const storedUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        passwordHash: true,
      },
    });

    expect(storedUser).not.toBeNull();
    expect(storedUser?.passwordHash).not.toBe(password);
    expect(storedUser?.passwordHash.startsWith('$argon2id$')).toBe(true);
  });

  it('rejects duplicate email registration', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: normalizedEmail,
        password,
      })
      .expect(409);

    expect(response.body).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
    });
  });

  it('rejects attempts to assign an admin role during registration', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: attackerEmail,
        password,
        role: 'ADMIN',
      })
      .expect(400);

    const attacker = await prisma.user.findUnique({
      where: {
        email: attackerEmail,
      },
    });

    expect(attacker).toBeNull();
  });

  it('rejects invalid email addresses', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'not-an-email',
        password,
      })
      .expect(400);
  });

  it('rejects passwords shorter than twelve characters', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: `short-password.${uniqueId}@blx.local`,
        password: 'short123',
      })
      .expect(400);
  });

  it('logs in with valid credentials and creates a hashed session', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: rawEmail,
        password,
      })
      .expect(200);

    expect(response.body).toMatchObject({
      user: {
        email: normalizedEmail,
        role: 'CUSTOMER',
      },
    });

    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('sessionToken');

    const setCookie = response.headers['set-cookie'];

    expect(setCookie).toBeDefined();

    const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;

    expect(cookie).toContain('blx_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');

    const cookiePair = cookie.split(';')[0];
    const sessionToken = cookiePair.substring(
      'blx_session='.length,
    );

    const tokenHash = createHash('sha256')
      .update(sessionToken)
      .digest('hex');

    const storedSession = await prisma.session.findUnique({
      where: {
        tokenHash,
      },
    });

    expect(storedSession).not.toBeNull();
    expect(storedSession?.tokenHash).toBe(tokenHash);
    expect(storedSession?.tokenHash).not.toBe(sessionToken);
    expect(storedSession?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects an incorrect password', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: normalizedEmail,
        password: 'incorrect-password',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password.',
    });
  });

  it('rejects an unknown email address', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: unknownEmail,
        password,
      })
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid email or password.',
    });
  });
});
