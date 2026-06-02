import { apiClient } from "./apiClient";
import type {
  Order,
  OrderAddress,
  OrderItem,
  OrderSeller,
  PaymentInstruction,
  PaymentMethod,
  ShippingMethod,
  FlashSaleCampaign,
  FlashSaleCreatePayload,
  FlashSaleItem,
} from "../types/api";

type PaymentInstructionPayload = {
  paymentId: number;
  status?: string;
  amount?: number | string | null;
  currency?: string;
  invoiceNumber?: string | null;
  qrCodeUrl?: string | null;
  qrImageBase64?: string | null;
  transferContent?: string | null;
  checkoutUrl?: string | null;
  expiredAt?: string | null;
};

type OrderAddressPayload = {
  fullName?: string;
  phone?: string;
  addressLine?: string;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
};

type OrderItemPayload = {
  id: number;
  productId: number;
  quantity?: number | string | null;
  price?: number | string | null;
  products?: {
    id: number;
    name?: string;
    thumbnail?: string | null;
    price?: number | string | null;
    description?: string | null;
    stock?: number | string | null;
  } | null;
};

type OrderSellerPayload = {
  sellerId?: string | null;
  sellerName?: string | null;
  itemCount?: number | string | null;
};

type OrderPayload = {
  id: number;
  orderNo?: string;
  userId?: string;
  status?: string;
  subtotal?: number | string | null;
  tax?: number | string | null;
  shippingMethodId?: number | null;
  shippingMethodName?: string | null;
  shippingFee?: number | string | null;
  discount?: number | string | null;
  total?: number | string | null;
  paymentStatus?: string;
  paymentMethod?: string;
  nextAction?: string;
  payment?: PaymentInstructionPayload | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  address?: OrderAddressPayload | null;
  items?: OrderItemPayload[];
  sellers?: OrderSellerPayload[];
};

type PaymentMethodPayload = {
  code: string;
  name: string;
  description?: string | null;
  enabled?: boolean;
  type?: string;
  priority?: number | string | null;
  features?: string[];
};

type ShippingMethodPayload = {
  id?: number;
  name: string;
  description?: string | null;
  estimatedMinDays?: number | null;
  estimatedMaxDays?: number | null;
  fee?: number | string | null;
  active?: boolean;
};

type FlashSaleItemResponsePayload = {
  id: number;
  campaignId?: number | string | null;
  productId?: number | string | null;
  variantId?: number | string | null;
  productName?: string | null;
  productThumbnail?: string | null;
  originalPrice?: number | string | null;
  salePrice?: number | string | null;
  stockLimit?: number | string | null;
  reservedCount?: number | string | null;
  soldCount?: number | string | null;
  remainingStock?: number | string | null;
  perUserLimit?: number | string | null;
  status?: string | null;
};

type FlashSaleCampaignResponsePayload = {
  id: number;
  name?: string | null;
  status?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  items?: FlashSaleItemResponsePayload[];
};

const toNumber = (value: unknown, fallback = 0) => Number(value ?? fallback);

const mapPayment = (payload?: PaymentInstructionPayload | null): PaymentInstruction | null => {
  if (!payload) {
    return null;
  }

  return {
    paymentId: payload.paymentId,
    status: payload.status ?? "",
    amount: toNumber(payload.amount),
    currency: payload.currency ?? "VND",
    invoiceNumber: payload.invoiceNumber ?? null,
    qrCodeUrl: payload.qrCodeUrl ?? null,
    qrImageBase64: payload.qrImageBase64 ?? null,
    transferContent: payload.transferContent ?? null,
    checkoutUrl: payload.checkoutUrl ?? null,
    expiredAt: payload.expiredAt ?? null,
  };
};

const mapAddress = (payload?: OrderAddressPayload | null): OrderAddress | null => {
  if (!payload) {
    return null;
  }

  return {
    fullName: payload.fullName ?? "",
    phone: payload.phone ?? "",
    addressLine: payload.addressLine ?? "",
    city: payload.city ?? null,
    province: payload.province ?? null,
    postalCode: payload.postalCode ?? null,
  };
};

const mapOrderItem = (payload: OrderItemPayload): OrderItem => ({
  id: payload.id,
  productId: payload.productId,
  quantity: toNumber(payload.quantity),
  price: toNumber(payload.price),
  products: payload.products
    ? {
        id: payload.products.id,
        name: payload.products.name ?? "",
        thumbnail: payload.products.thumbnail ?? null,
        price: toNumber(payload.products.price),
        description: payload.products.description ?? null,
        stock: toNumber(payload.products.stock),
      }
    : null,
});

const mapSeller = (payload: OrderSellerPayload): OrderSeller => ({
  sellerId: payload.sellerId ?? "",
  sellerName: payload.sellerName ?? "Seller",
  itemCount: toNumber(payload.itemCount),
});

const mapOrder = (payload: OrderPayload): Order => ({
  id: payload.id,
  orderNo: payload.orderNo ?? `#${payload.id}`,
  userId: payload.userId ?? "",
  status: payload.status ?? "",
  subtotal: toNumber(payload.subtotal),
  tax: toNumber(payload.tax),
  shippingMethodId: payload.shippingMethodId ?? null,
  shippingMethodName: payload.shippingMethodName ?? null,
  shippingFee: toNumber(payload.shippingFee),
  discount: toNumber(payload.discount),
  total: toNumber(payload.total),
  paymentStatus: payload.paymentStatus ?? "",
  paymentMethod: payload.paymentMethod ?? "",
  nextAction: payload.nextAction ?? "NONE",
  payment: mapPayment(payload.payment),
  createdAt: payload.createdAt ?? null,
  updatedAt: payload.updatedAt ?? null,
  address: mapAddress(payload.address),
  items: Array.isArray(payload.items) ? payload.items.map(mapOrderItem) : [],
  sellers: Array.isArray(payload.sellers) ? payload.sellers.map(mapSeller) : [],
});

const mapPaymentMethod = (payload: PaymentMethodPayload): PaymentMethod => ({
  code: payload.code,
  name: payload.name,
  description: payload.description ?? "",
  enabled: Boolean(payload.enabled),
  type: payload.type ?? "OFFLINE",
  priority: toNumber(payload.priority, 99),
  features: Array.isArray(payload.features) ? payload.features : [],
});

const mapShippingMethod = (payload: ShippingMethodPayload): ShippingMethod => ({
  id: payload.id||0,
  name: payload.name,
  description: payload.description ?? null,
  estimatedMinDays: payload.estimatedMinDays ?? null,
  estimatedMaxDays: payload.estimatedMaxDays ?? null,
  fee: toNumber(payload.fee),
  active: Boolean(payload.active),
});

const mapFlashSaleItem = (payload: FlashSaleItemResponsePayload): FlashSaleItem => ({
  id: payload.id,
  campaignId: toNumber(payload.campaignId),
  productId: toNumber(payload.productId),
  variantId: payload.variantId == null ? null : toNumber(payload.variantId),
  productName: payload.productName ?? `Product #${payload.productId ?? ""}`,
  productThumbnail: payload.productThumbnail ?? null,
  originalPrice: toNumber(payload.originalPrice),
  salePrice: toNumber(payload.salePrice),
  stockLimit: toNumber(payload.stockLimit),
  reservedCount: toNumber(payload.reservedCount),
  soldCount: toNumber(payload.soldCount),
  remainingStock: toNumber(payload.remainingStock),
  perUserLimit: toNumber(payload.perUserLimit, 1),
  status: payload.status ?? "",
});

const mapFlashSaleCampaign = (
  payload: FlashSaleCampaignResponsePayload,
): FlashSaleCampaign => ({
  id: payload.id,
  name: payload.name ?? "",
  status: payload.status ?? "",
  startsAt: payload.startsAt ?? null,
  endsAt: payload.endsAt ?? null,
  items: Array.isArray(payload.items) ? payload.items.map(mapFlashSaleItem) : [],
});

export const commerceService = {
  async getSellerOrders(status?: string): Promise<Order[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await apiClient.get<OrderPayload[]>(`/commerce/orders/seller${suffix}`);
    return data.map(mapOrder);
  },
  async getAdminOrders(status?: string): Promise<Order[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await apiClient.get<OrderPayload[]>(`/commerce/admin/orders${suffix}`);
    return data.map(mapOrder);
  },
  async getOrder(id: number): Promise<Order> {
    const data = await apiClient.get<OrderPayload>(`/commerce/orders/${id}`);
    return mapOrder(data);
  },
  async advanceOrder(id: number): Promise<Order> {
    const data = await apiClient.post<OrderPayload>(`/commerce/orders/${id}/next`, {});
    return mapOrder(data);
  },
  async cancelOrder(id: number): Promise<Order> {
    const data = await apiClient.post<OrderPayload>(`/commerce/orders/${id}/cancel`, {});
    return mapOrder(data);
  },
  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const data = await apiClient.patch<OrderPayload>(`/commerce/orders/${id}/status`, {
      status,
    });
    return mapOrder(data);
  },
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const data = await apiClient.get<{ methods: PaymentMethodPayload[] }>("/payment-methods");
    return (data.methods ?? [])
      .map(mapPaymentMethod)
      .sort((left, right) => left.priority - right.priority);
  },
  async createPaymentMethod(payload: PaymentMethodPayload): Promise<PaymentMethod> {
    const data = await apiClient.post<PaymentMethodPayload>("/payment-methods", payload);
    return mapPaymentMethod(data);
  },
  async updatePaymentMethod(code: string, payload: PaymentMethodPayload): Promise<PaymentMethod> {
    const data = await apiClient.put<PaymentMethodPayload>(`/payment-methods/${code}`, payload);
    return mapPaymentMethod(data);
  },
  async deletePaymentMethod(code: string): Promise<void> {
    return apiClient.delete<void>(`/payment-methods/${code}`);
  },
  async getShippingMethods(): Promise<ShippingMethod[]> {
    const data = await apiClient.get<{ methods: ShippingMethodPayload[] }>("/shipping-methods");
    return (data.methods ?? []).map(mapShippingMethod);
  },
  async createShippingMethod(payload: ShippingMethodPayload): Promise<ShippingMethod> {
    const data = await apiClient.post<ShippingMethodPayload>("/shipping-methods", payload);
    return mapShippingMethod(data);
  },
  async updateShippingMethod(id: number, payload: ShippingMethodPayload): Promise<ShippingMethod> {
    const data = await apiClient.put<ShippingMethodPayload>(`/commerce/shipping-methods/${id}`, payload);
    return mapShippingMethod(data);
  },
  async deleteShippingMethod(id: number): Promise<void> {
    return apiClient.delete<void>(`/commerce/shipping-methods/${id}`);
  },
  async getFlashSaleCampaigns(limit = 20): Promise<FlashSaleCampaign[]> {
    const data = await apiClient.get<FlashSaleCampaignResponsePayload[]>(
      `/commerce/admin/flash-sales?limit=${encodeURIComponent(String(limit))}`,
    );
    return data.map(mapFlashSaleCampaign);
  },
  async createFlashSaleCampaign(
    payload: FlashSaleCreatePayload,
  ): Promise<FlashSaleCampaign> {
    const data = await apiClient.post<FlashSaleCampaignResponsePayload>(
      "/commerce/admin/flash-sales",
      payload,
    );
    return mapFlashSaleCampaign(data);
  },
};
