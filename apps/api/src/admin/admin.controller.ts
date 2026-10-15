import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(
  AuthGuard,
  AdminGuard,
)
export class AdminController {
  constructor(
    private readonly adminService:
      AdminService,
  ) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('orders')
  listOrders() {
    return this.adminService.listOrders();
  }

  @Get('inventory')
  listInventory() {
    return this.adminService.listInventory();
  }
}
