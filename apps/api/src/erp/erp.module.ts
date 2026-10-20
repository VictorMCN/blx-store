import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { ErpAdminController } from './erp-admin.controller.js';
import { ErpInventorySyncService } from './erp-inventory-sync.service.js';
import { ErpSyncService } from './erp-sync.service.js';
import { MockErpProvider } from './mock-erp.provider.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
  ],
  controllers: [
    ErpAdminController,
  ],
  providers: [
    ErpSyncService,
    ErpInventorySyncService,
    MockErpProvider,
  ],
  exports: [
    ErpSyncService,
    ErpInventorySyncService,
  ],
})
export class ErpModule {}
