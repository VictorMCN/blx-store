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
    const weightStart = digits.length + 1;

    const sum = digits.reduce(
      (total, digit, index) =>
        total +
        digit * (weightStart - index),
      0,
    );

    const remainder = (sum * 10) % 11;

    return remainder === 10
      ? 0
      : remainder;
  };

  const firstDigit = calculateDigit(base);

  const secondDigit = calculateDigit([
    ...base,
    firstDigit,
  ]);

  return [
    ...base,
    firstDigit,
    secondDigit,
  ].join('');
}

describe('Customer addresses (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let ownerCookie: string;
  let secondUserCookie: string;
  let firstAddressId: string;
  let secondAddressId: string;

  const uniqueId = Date.now();

  const ownerEmail =
    `address.owner.${uniqueId}@blx.local`;

  const secondUserEmail =
    `address.second.${uniqueId}@blx.local`;

  const password = 'BLX-e2e-password-123';

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    configureApp(app);

    prisma =
      moduleFixture.get<PrismaService>(
        PrismaService,
      );

    await app.init();

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: ownerEmail,
        password,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: secondUserEmail,
        password,
      })
      .expect(201);

    const ownerLogin =
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: ownerEmail,
          password,
        })
        .expect(200);

    const secondLogin =
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: secondUserEmail,
          password,
        })
        .expect(200);

    const ownerSetCookie =
      ownerLogin.headers['set-cookie'];

    const secondSetCookie =
      secondLogin.headers['set-cookie'];

    ownerCookie = (
      Array.isArray(ownerSetCookie)
        ? ownerSetCookie[0]
        : ownerSetCookie
    ).split(';')[0];

    secondUserCookie = (
      Array.isArray(secondSetCookie)
        ? secondSetCookie[0]
        : secondSetCookie
    ).split(';')[0];

    await request(app.getHttpServer())
      .put('/api/account/profile')
      .set('Cookie', ownerCookie)
      .send({
        accountType: 'INDIVIDUAL',
        fullName: 'Address Owner',
        taxId: generateCpf(uniqueId),
      })
      .expect(200);

    await request(app.getHttpServer())
      .put('/api/account/profile')
      .set('Cookie', secondUserCookie)
      .send({
        accountType: 'INDIVIDUAL',
        fullName: 'Second Address User',
        taxId: generateCpf(uniqueId + 1),
      })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            ownerEmail,
            secondUserEmail,
          ],
        },
      },
    });

    await app.close();
  });

  it('rejects address access without authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/account/addresses')
      .expect(401);
  });

  it('returns an empty address list initially', async () => {
    const response =
      await request(app.getHttpServer())
        .get('/api/account/addresses')
        .set('Cookie', ownerCookie)
        .expect(200);

    expect(response.body).toEqual({
      addresses: [],
    });
  });

  it('creates the first address as the default address', async () => {
    const response =
      await request(app.getHttpServer())
        .post('/api/account/addresses')
        .set('Cookie', ownerCookie)
        .send({
          label: ' Home ',
          recipientName: ' Address Owner ',
          street: 'Demo Street',
          number: '100',
          complement: 'Apartment 10',
          neighborhood: 'Central',
          city: 'Brasilia',
          state: 'DF',
          postalCode: '70000-000',
          country: 'br',
          isDefault: false,
        })
        .expect(201);

    expect(response.body).toMatchObject({
      address: {
        label: 'Home',
        recipientName: 'Address Owner',
        street: 'Demo Street',
        number: '100',
        city: 'Brasilia',
        state: 'DF',
        postalCode: '70000-000',
        country: 'BR',
        isDefault: true,
      },
    });

    firstAddressId =
      response.body.address.id;
  });

  it('creates another address and makes it the default', async () => {
    const response =
      await request(app.getHttpServer())
        .post('/api/account/addresses')
        .set('Cookie', ownerCookie)
        .send({
          label: 'Office',
          recipientName: 'Address Owner',
          street: 'Business Avenue',
          number: '200',
          city: 'Brasilia',
          state: 'DF',
          postalCode: '70000-001',
          country: 'BR',
          isDefault: true,
        })
        .expect(201);

    secondAddressId =
      response.body.address.id;

    expect(
      response.body.address.isDefault,
    ).toBe(true);

    const firstAddress =
      await prisma.address.findUnique({
        where: {
          id: firstAddressId,
        },
        select: {
          isDefault: true,
        },
      });

    expect(firstAddress?.isDefault).toBe(
      false,
    );
  });

  it('lists only addresses owned by the authenticated customer', async () => {
    const ownerResponse =
      await request(app.getHttpServer())
        .get('/api/account/addresses')
        .set('Cookie', ownerCookie)
        .expect(200);

    expect(
      ownerResponse.body.addresses,
    ).toHaveLength(2);

    expect(
      ownerResponse.body.addresses[0].id,
    ).toBe(secondAddressId);

    const secondUserResponse =
      await request(app.getHttpServer())
        .get('/api/account/addresses')
        .set('Cookie', secondUserCookie)
        .expect(200);

    expect(
      secondUserResponse.body.addresses,
    ).toEqual([]);
  });

  it('prevents another customer from updating an address they do not own', async () => {
    await request(app.getHttpServer())
      .put(
        `/api/account/addresses/${firstAddressId}`,
      )
      .set('Cookie', secondUserCookie)
      .send({
        label: 'Stolen',
        recipientName: 'Second User',
        street: 'Unauthorized Street',
        number: '999',
        city: 'Brasilia',
        state: 'DF',
        postalCode: '70000-999',
        country: 'BR',
      })
      .expect(404);

    const address =
      await prisma.address.findUnique({
        where: {
          id: firstAddressId,
        },
      });

    expect(address?.street).toBe(
      'Demo Street',
    );
  });

  it('prevents another customer from deleting an address they do not own', async () => {
    await request(app.getHttpServer())
      .delete(
        `/api/account/addresses/${firstAddressId}`,
      )
      .set('Cookie', secondUserCookie)
      .expect(404);

    const address =
      await prisma.address.findUnique({
        where: {
          id: firstAddressId,
        },
      });

    expect(address).not.toBeNull();
  });

  it('updates an owned address and can make it the default', async () => {
    const response =
      await request(app.getHttpServer())
        .put(
          `/api/account/addresses/${firstAddressId}`,
        )
        .set('Cookie', ownerCookie)
        .send({
          label: 'Home',
          recipientName: 'Address Owner',
          street: 'Updated Demo Street',
          number: '101',
          city: 'Brasilia',
          state: 'DF',
          postalCode: '70000-010',
          country: 'BR',
          isDefault: true,
        })
        .expect(200);

    expect(response.body).toMatchObject({
      address: {
        id: firstAddressId,
        street: 'Updated Demo Street',
        number: '101',
        isDefault: true,
      },
    });

    const secondAddress =
      await prisma.address.findUnique({
        where: {
          id: secondAddressId,
        },
        select: {
          isDefault: true,
        },
      });

    expect(secondAddress?.isDefault).toBe(
      false,
    );
  });

  it('rejects attempts to assign a customer ID manually', async () => {
    await request(app.getHttpServer())
      .post('/api/account/addresses')
      .set('Cookie', ownerCookie)
      .send({
        recipientName: 'Address Owner',
        street: 'Injected Street',
        number: '300',
        city: 'Brasilia',
        state: 'DF',
        postalCode: '70000-300',
        country: 'BR',
        customerId:
          '00000000-0000-0000-0000-000000000000',
      })
      .expect(400);
  });

  it('rejects malformed address identifiers', async () => {
    await request(app.getHttpServer())
      .delete(
        '/api/account/addresses/not-a-uuid',
      )
      .set('Cookie', ownerCookie)
      .expect(400);
  });

  it('promotes another address when the default address is deleted', async () => {
    await request(app.getHttpServer())
      .delete(
        `/api/account/addresses/${firstAddressId}`,
      )
      .set('Cookie', ownerCookie)
      .expect(204);

    const remainingAddress =
      await prisma.address.findUnique({
        where: {
          id: secondAddressId,
        },
        select: {
          isDefault: true,
        },
      });

    expect(
      remainingAddress?.isDefault,
    ).toBe(true);
  });
});
