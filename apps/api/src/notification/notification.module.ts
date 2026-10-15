import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module.js';
import { EmailService } from './email.service.js';

@Module({
  imports: [
    PrismaModule,
  ],
  providers: [
    EmailService,
  ],
  exports: [
    EmailService,
  ],
})
export class NotificationModule {}
