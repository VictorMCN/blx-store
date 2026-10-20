import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AssistantService } from './assistant.service.js';
import { AssistantChatDto } from './dto/assistant-chat.dto.js';

@Controller('assistant')
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(
    private readonly assistantService:
      AssistantService,
  ) {}

  @Post('chat')
  chat(
    @CurrentUser()
    user: AuthenticatedUser,
    @Body()
    dto: AssistantChatDto,
  ) {
    return this.assistantService.chat(
      user.id,
      dto,
    );
  }
}
