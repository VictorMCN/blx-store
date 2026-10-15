export type UserRole = "CUSTOMER" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
}

export interface ProductImage {
  id?: string;
  url: string;
  altText?: string | null;
  position?: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  priceInCents: number;
  currency: string;
  category: {
    id?: string;
    name: string;
    slug: string;
  };
  images: ProductImage[];
  availability: {
    inStock: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CatalogResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface CartItem {
  id: string;
  quantity: number;
  lineTotalInCents: number;
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    priceInCents: number;
    currency: string;
    primaryImage: ProductImage | null;
  };
  availability: {
    isAvailable: boolean;
    reason:
      | "PRODUCT_UNAVAILABLE"
      | "OUT_OF_STOCK"
      | "INSUFFICIENT_STOCK"
      | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  id: string | null;
  items: CartItem[];
  distinctItemCount: number;
  totalItemCount: number;
  subtotalInCents: number;
  currency: string | null;
  canCheckout: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CustomerProfile {
  id: string;
  accountType: "INDIVIDUAL" | "BUSINESS";
  fullName: string | null;
  legalName: string | null;
  tradeName: string | null;
  taxIdMasked: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  id: string;
  label: string | null;
  recipientName: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED"
  | "EXPIRED";

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  subtotalInCents: number;
  shippingInCents: number;
  totalInCents: number;
  itemCount: number;
  reservationExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string | null;
  productName: string;
  productSlug: string;
  productSku: string;
  unitPriceInCents: number;
  quantity: number;
  lineTotalInCents: number;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  subtotalInCents: number;
  shippingInCents: number;
  totalInCents: number;
  customerAccountType: "INDIVIDUAL" | "BUSINESS";
  customerName: string;
  customerEmail: string;
  customerTaxIdMasked: string;
  customerPhone: string | null;
  shippingRecipientName: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingComplement: string | null;
  shippingNeighborhood: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  reservationExpiresAt: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}
