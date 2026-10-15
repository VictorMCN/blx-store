import { IsIn } from 'class-validator';
import type { OrderStatus } from '../../generated/prisma/enums.js';

export class UpdateOrderStatusDto {
  @IsIn([
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
  ])
  status!: OrderStatus;
}
