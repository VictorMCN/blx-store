import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CustomerAddressService } from './customer-address.service.js';
import { SaveAddressDto } from './dto/save-address.dto.js';

@Controller('account/addresses')
@UseGuards(AuthGuard)
export class CustomerAddressController {
  constructor(
    private readonly customerAddressService:
      CustomerAddressService,
  ) {}

  @Get()
  listAddresses(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customerAddressService.listAddresses(
      user.id,
    );
  }

  @Post()
  createAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveAddressDto,
  ) {
    return this.customerAddressService.createAddress(
      user.id,
      dto,
    );
  }

  @Put(':id')
  updateAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SaveAddressDto,
  ) {
    return this.customerAddressService.updateAddress(
      user.id,
      id,
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.customerAddressService.deleteAddress(
      user.id,
      id,
    );
  }
}
