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
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CartService } from './cart.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';

@Controller('cart')
@UseGuards(AuthGuard)
export class CartController {
  constructor(
    private readonly cartService:
      CartService,
  ) {}

  @Get()
  getCart(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.cartService.getCart(
      user.id,
    );
  }

  @Post('items')
  addItem(
    @CurrentUser()
    user: AuthenticatedUser,
    @Body()
    dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(
      user.id,
      dto,
    );
  }

  @Put('items/:productId')
  updateItem(
    @CurrentUser()
    user: AuthenticatedUser,
    @Param(
      'productId',
      new ParseUUIDPipe(),
    )
    productId: string,
    @Body()
    dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(
      user.id,
      productId,
      dto,
    );
  }

  @Delete('items/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeItem(
    @CurrentUser()
    user: AuthenticatedUser,
    @Param(
      'productId',
      new ParseUUIDPipe(),
    )
    productId: string,
  ) {
    await this.cartService.removeItem(
      user.id,
      productId,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCart(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    await this.cartService.clearCart(
      user.id,
    );
  }
}
