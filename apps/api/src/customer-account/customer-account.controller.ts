import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  AuthGuard,
} from '../auth/auth.guard.js';
import type {
  AuthenticatedUser,
} from '../auth/auth.types.js';
import {
  CurrentUser,
} from '../auth/current-user.decorator.js';
import {
  CustomerAccountService,
} from './customer-account.service.js';
import {
  UpsertCustomerProfileDto,
} from './dto/upsert-customer-profile.dto.js';

@Controller('account')
@UseGuards(AuthGuard)
export class CustomerAccountController {
  constructor(
    private readonly customerAccountService:
      CustomerAccountService,
  ) {}

  @Get('profile')
  getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customerAccountService.getProfile(
      user.id,
    );
  }

  @Put('profile')
  upsertProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertCustomerProfileDto,
  ) {
    return this.customerAccountService.upsertProfile(
      user.id,
      dto,
    );
  }
}
