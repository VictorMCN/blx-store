import {
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { httpLoggingMiddleware } from './observability/http-logging.middleware.js';
import { SafeExceptionFilter } from './observability/safe-exception.filter.js';
import { csrfOriginMiddleware } from './security/csrf-origin.middleware.js';

interface HttpApplication {
  disable?: (setting: string) => void;
}

export function configureApp(
  app: INestApplication,
): void {
  app.setGlobalPrefix('api');

  const httpApplication =
    app.getHttpAdapter().getInstance() as HttpApplication;

  httpApplication.disable?.('x-powered-by');

  app.use(helmet());

  app.use(httpLoggingMiddleware);

  app.use(cookieParser());

  app.use(csrfOriginMiddleware);

  app.useGlobalFilters(
    new SafeExceptionFilter(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
