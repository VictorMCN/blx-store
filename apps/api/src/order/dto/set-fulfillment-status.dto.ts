import { IsIn } from 'class-validator';
import type { OrderStatus } from '../../generated/prisma/enums.js';

export class SetFulfillmentStatusDto {
  @IsIn([
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
  ])
  status!: OrderStatus;
}
