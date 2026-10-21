import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  Throttle,
  ThrottlerGuard,
} from '@nestjs/throttler';
import {
  AuthGuard,
  type AuthenticatedRequest,
} from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AssistantService } from './assistant.service.js';
import { AssistantChatDto } from './dto/assistant-chat.dto.js';

@Controller('assistant')
@UseGuards(AuthGuard, ThrottlerGuard)
export class AssistantController {
  constructor(
    private readonly assistantService:
      AssistantService,
  ) {}

  @Post('chat')
  @Throttle({
    default: {
      limit: 10,
      ttl: 60_000,
      getTracker: (request) => {
        const user = (
          request as AuthenticatedRequest
        ).user;

        if (!user) {
          throw new UnauthorizedException(
            'Authentication required.',
          );
        }

        return `assistant-user:${user.id}`;
      },
    },
  })
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
