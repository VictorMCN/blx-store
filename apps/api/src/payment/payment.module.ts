import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { PaymentController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import { StripeService } from './stripe.service.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
  ],
  controllers: [
    PaymentController,
    StripeWebhookController,
  ],
  providers: [
    PaymentService,
    StripeService,
  ],
  exports: [StripeService],
})
export class PaymentModule {}
