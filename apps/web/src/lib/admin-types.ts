import type {
  OrderStatus,
} from "./types";

export interface AdminMetrics {
  paidRevenueInCents: number;
  currency: string;
  totalOrders: number;
  activeFulfillmentOrders: number;
  lowStockProducts: number;
}

export interface AdminOrderItem {
  productName: string;
  productSku: string;
  quantity: number;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  currency: string;
  subtotalInCents: number;
  shippingInCents: number;
  totalInCents: number;
  itemCount: number;
  items: AdminOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminDashboardResponse {
  metrics: AdminMetrics;
  recentOrders: AdminOrder[];
}

export interface AdminOrdersResponse {
  orders: AdminOrder[];
}

export interface AdminInventoryItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderPoint: number;
  hasInventory: boolean;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

export interface AdminInventoryResponse {
  inventory: AdminInventoryItem[];
}
