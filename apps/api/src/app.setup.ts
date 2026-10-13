import {
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import cookieParser from 'cookie-parser';

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

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
