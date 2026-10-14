import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    {
      rawBody: true,
    },
  );

  configureApp(app);

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;

  await app.listen(port);
}

void bootstrap();
