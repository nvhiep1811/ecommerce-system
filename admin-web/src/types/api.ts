export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  role: "ADMIN" | "SELLER" | "CUSTOMER" | string;
};

export type AuthResponse = {
  accessToken: string;
  user: AdminUser;
};

export type ManagedUser = AdminUser & {
  status: "active" | "inactive" | "blocked" | string;
  roles?: string[];
};

export type Category = {
  id: number;
  parentId: number | null;
  name: string;
};

export type Product = {
  id: number;
  subCategoryId: number | null;
  name: string;
  description: string;
  thumbnail: string | null;
  price: number;
  stock: number;
  unit: string | null;
  rating: number;
  reviewCount: number;
  brand: string | null;
  createdAt: string | null;
  sellerId: string | null;
  sellerName: string | null;
};

export type ProductPage = {
  items: Product[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
};

export type ProductUpsertPayload = {
  name: string;
  description: string;
  price: number;
  subCategoryId: number;
  stock: number;
  unit?: string | null;
  thumbnail?: string | null;
};

export type Coupon = {
  id: number;
  code: string;
  description: string | null;
  discountType: "percent" | "fixed" | string;
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number | null;
  startAt: string | null;
  endAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
  createdAt: string | null;
};

export type CouponPayload = {
  code?: string;
  description?: string | null;
  discountType?: "percent" | "fixed";
  discountValue?: number;
  minOrderValue?: number;
  maxDiscount?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  usageLimit?: number | null;
  active?: boolean;
};

export type OrderProduct = {
  id: number;
  name: string;
  thumbnail: string | null;
  price: number;
  description: string | null;
  stock: number;
};

export type OrderItem = {
  id: number;
  productId: number;
  quantity: number;
  price: number;
  products?: OrderProduct | null;
};

export type OrderAddress = {
  fullName: string;
  phone: string;
  addressLine: string;
  city: string | null;
  province: string | null;
  postalCode: string | null;
};

export type OrderSeller = {
  sellerId: string;
  sellerName: string;
  itemCount: number;
};

export type PaymentInstruction = {
  paymentId: number;
  status: string;
  amount: number;
  currency: string;
  invoiceNumber?: string | null;
  qrCodeUrl?: string | null;
  qrImageBase64?: string | null;
  transferContent?: string | null;
  checkoutUrl?: string | null;
  expiredAt?: string | null;
};

export type Order = {
  id: number;
  orderNo: string;
  userId: string;
  status: string;
  subtotal: number;
  tax: number;
  shippingMethodId: number | null;
  shippingMethodName: string | null;
  shippingFee: number;
  discount: number;
  total: number;
  paymentStatus: string;
  paymentMethod: string;
  nextAction: string;
  payment: PaymentInstruction | null;
  createdAt: string | null;
  updatedAt: string | null;
  address?: OrderAddress | null;
  items: OrderItem[];
  sellers: OrderSeller[];
};

export type PaymentMethod = {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  type: string;
  priority: number;
  features: string[];
};

export type ShippingMethod = {
  id: number;
  name: string;
  description: string | null;
  estimatedMinDays: number | null;
  estimatedMaxDays: number | null;
  fee: number;
  active: boolean;
};


export type UserSummary = {
  total: number;
  sellers: number;
  customers: number;
  blocked: number;
};

export type UserListResponse = {
  users: ManagedUser[];
  summary: UserSummary;
};

export type CategoryPayload = {
  name: string;
  parentId?: number | null;
};

export type PaymentMethodPayload = {
  code: string;
  name: string;
  description?: string;
  enabled?: boolean;
  type?: string;
  priority?: number;
  features?: string[];
};

export type ShippingMethodPayload = {
  name: string;
  description?: string;
  estimatedMinDays?: number | null;
  estimatedMaxDays?: number | null;
  fee?: number;
  active?: boolean;
};