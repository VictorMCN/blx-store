import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../database/prisma.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { AssistantToolsService } from './assistant-tools.service.js';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
  ],
  controllers: [
    AssistantController,
  ],
  providers: [
    AssistantService,
    AssistantToolsService,
  ],
})
export class AssistantModule {}
