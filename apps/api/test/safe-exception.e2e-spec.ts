import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  type INestApplication,
} from '@nestjs/common';
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
  vi,
} from 'vitest';
import { configureApp } from '../src/app.setup.js';

const PRIVATE_DETAIL =
  'private-customer@example.com';

@Controller('exception-test')
class ExceptionTestController {
  @Get('unexpected')
  unexpected(): never {
    throw Object.assign(
      new Error(
        `Sensitive database row: ${PRIVATE_DETAIL}`,
      ),
      {
        code: 'P2039',
        meta: {
          detail: PRIVATE_DETAIL,
        },
      },
    );
  }

  @Get('expected')
  expected(): never {
    throw new BadRequestException(
      'Expected validation error.',
    );
  }
}

describe('SafeExceptionFilter (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        controllers: [
          ExceptionTestController,
        ],
      }).compile();

    app = moduleFixture.createNestApplication();

    configureApp(app);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it('sanitizes unexpected errors and their logs', async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const response = await request(
      app.getHttpServer(),
    )
      .get('/api/exception-test/unexpected')
      .expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
    });

    expect(response.headers['x-request-id']).toEqual(
      expect.any(String),
    );

    expect(errorSpy).toHaveBeenCalled();

    const logged = JSON.stringify(
      errorSpy.mock.calls,
    );

    expect(logged).toContain(
      'unhandled_exception',
    );

    expect(logged).toContain('P2039');

    expect(logged).not.toContain(
      PRIVATE_DETAIL,
    );

    expect(
      JSON.stringify(response.body),
    ).not.toContain(PRIVATE_DETAIL);

    errorSpy.mockRestore();
  });

  it('preserves expected HTTP exceptions', async () => {
    const response = await request(
      app.getHttpServer(),
    )
      .get('/api/exception-test/expected')
      .expect(400);

    expect(response.body).toEqual({
      message: 'Expected validation error.',
      error: 'Bad Request',
      statusCode: 400,
    });
  });
});
