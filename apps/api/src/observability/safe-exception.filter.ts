import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

function getSafeDatabaseCode(
  exception: unknown,
): string | null {
  if (
    typeof exception !== 'object' ||
    exception === null ||
    !('code' in exception)
  ) {
    return null;
  }

  const code = exception.code;

  return typeof code === 'string' &&
    /^P[0-9]{4}$/.test(code)
    ? code
    : null;
}

@Catch()
export class SafeExceptionFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(
    SafeExceptionFilter.name,
  );

  catch(
    exception: unknown,
    host: ArgumentsHost,
  ): void {
    const response = host
      .switchToHttp()
      .getResponse<Response>();

    if (response.headersSent) {
      return;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const body = exception.getResponse();

      response.status(statusCode).json(
        typeof body === 'string'
          ? {
              statusCode,
              message: body,
            }
          : body,
      );

      return;
    }

    const requestId = response.getHeader(
      'X-Request-ID',
    );

    const databaseCode = getSafeDatabaseCode(
      exception,
    );

    this.logger.error(
      JSON.stringify({
        event: 'unhandled_exception',
        category: databaseCode
          ? 'database'
          : 'application',
        ...(databaseCode
          ? { code: databaseCode }
          : {}),
        ...(typeof requestId === 'string'
          ? { requestId }
          : {}),
      }),
    );

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({
        statusCode: 500,
        message: 'Internal server error',
      });
  }
}
