import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CartModule } from './cart/cart.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CustomerAccountModule } from './customer-account/customer-account.module.js';
import { PrismaModule } from './database/prisma.module.js';
import { ErpModule } from './erp/erp.module.js';
import { AiMetricsReporter } from './observability/ai-metrics.service.js';
import { HttpMetricsReporter } from './observability/http-metrics.service.js';
import { PaymentMetricsReporter } from './observability/payment-metrics.service.js';
import { OrderModule } from './order/order.module.js';
import { PaymentModule } from './payment/payment.module.js';

const enableApiCronJobs =
  process.env.NODE_ENV !== 'production' &&
  process.env.NODE_ENV !== 'test';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env',
        '../../.env',
      ],
    }),
    ScheduleModule.forRoot({
      cronJobs: enableApiCronJobs,
      intervals: true,
      timeouts: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    CustomerAccountModule,
    CatalogModule,
    CartModule,
    OrderModule,
    PaymentModule,
    AdminModule,
    AssistantModule,
    ErpModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
    AppService,
    HttpMetricsReporter,
    AiMetricsReporter,
    PaymentMetricsReporter,
  ],
})
export class AppModule {}
