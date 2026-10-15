import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { PaymentController } from './payment.controller.js';
import { PaymentExpirationService } from './payment-expiration.service.js';
import { PaymentService } from './payment.service.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import { StripeService } from './stripe.service.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    NotificationModule,
  ],
  controllers: [
    PaymentController,
    StripeWebhookController,
  ],
  providers: [
    PaymentService,
    PaymentExpirationService,
    StripeService,
  ],
  exports: [
    StripeService,
  ],
})
export class PaymentModule {}
