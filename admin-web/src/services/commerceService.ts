import { apiClient } from "./apiClient";
import type {
  Order,
  OrderAddress,
  OrderItem,
  PaymentInstruction,
  PaymentMethod,
  ShippingMethod,
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
  id: number;
  name: string;
  description?: string | null;
  estimatedMinDays?: number | null;
  estimatedMaxDays?: number | null;
  fee?: number | string | null;
  active?: boolean;
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
  id: payload.id,
  name: payload.name,
  description: payload.description ?? null,
  estimatedMinDays: payload.estimatedMinDays ?? null,
  estimatedMaxDays: payload.estimatedMaxDays ?? null,
  fee: toNumber(payload.fee),
  active: Boolean(payload.active),
});

export const commerceService = {
  async getSellerOrders(status?: string): Promise<Order[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await apiClient.get<OrderPayload[]>(`/commerce/orders/seller${suffix}`);
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
  async getShippingMethods(): Promise<ShippingMethod[]> {
    const data = await apiClient.get<{ methods: ShippingMethodPayload[] }>("/shipping-methods");
    return (data.methods ?? []).map(mapShippingMethod);
  },
};
