import { apiClient } from "@/services/apiClient";
import {
  Order,
  OrderAddressSnapshot,
  OrderInput,
  OrderItem,
  PaymentInstruction,
  PaymentMethod,
  PaymentStatus,
  OrderQuote,
  OrderQuoteCoupon,
  OrderQuoteInput,
  ShippingMethod,
} from "@/types/order";

const orderCache = new Map<number, Order>();

const mapOrderAddress = (payload: any): OrderAddressSnapshot => ({
  full_name: payload?.fullName ?? "",
  phone: payload?.phone ?? "",
  address_line: payload?.addressLine ?? "",
  city: payload?.city ?? "",
  province: payload?.province ?? "",
  postal_code: payload?.postalCode ?? "",
});

const mapQuoteCoupon = (payload: any): OrderQuoteCoupon => ({
  valid: Boolean(payload?.valid),
  discount: Number(payload?.discount ?? 0),
  message: payload?.message ?? "",
  coupon: payload?.coupon
    ? {
        id: payload.coupon.id,
        code: payload.coupon.code,
      }
    : null,
});

const mapOrderItem = (payload: any): OrderItem => ({
  id: payload.id,
  product_id: payload.productId,
  variant_id: payload.variantId ?? undefined,
  quantity: payload.quantity,
  price: Number(payload.price ?? 0),
  products: payload.products
    ? {
        id: payload.products.id,
        name: payload.products.name,
        thumbnail: payload.products.thumbnail,
        price: Number(payload.products.price ?? 0),
        description: payload.products.description ?? null,
        stock: payload.products.stock ?? 0,
      }
    : undefined,
});

const mapPaymentInstruction = (payload: any): PaymentInstruction | null => {
  if (!payload) {
    return null;
  }

  return {
    payment_id: payload.paymentId,
    status: payload.status,
    amount: Number(payload.amount ?? 0),
    currency: payload.currency ?? "VND",
    invoice_number: payload.invoiceNumber ?? null,
    qr_code_url: payload.qrCodeUrl ?? null,
    qr_image_base64: payload.qrImageBase64 ?? null,
    qr_content: payload.qrContent ?? null,
    transfer_content: payload.transferContent ?? null,
    bank_name: payload.bankName ?? null,
    bank_code: payload.bankCode ?? null,
    bank_bin: payload.bankBin ?? null,
    bank_account_number: payload.bankAccountNumber ?? null,
    account_name: payload.accountName ?? null,
    bank_deep_link: payload.bankDeepLink ?? null,
    checkout_url: payload.checkoutUrl ?? null,
    expired_at: payload.expiredAt ?? null,
  };
};

const mapPaymentMethod = (payload: any): PaymentMethod => ({
  code: payload.code,
  name: payload.name,
  description: payload.description ?? "",
  enabled: Boolean(payload.enabled),
  type: payload.type ?? "OFFLINE",
  priority: Number(payload.priority ?? 99),
  features: Array.isArray(payload.features) ? payload.features : [],
});

const mapShippingMethod = (payload: any): ShippingMethod => ({
  id: payload.id,
  name: payload.name,
  description: payload.description ?? null,
  estimated_min_days: payload.estimatedMinDays ?? null,
  estimated_max_days: payload.estimatedMaxDays ?? null,
  fee: Number(payload.fee ?? 0),
  active: Boolean(payload.active),
});

const mapPaymentStatus = (payload: any): PaymentStatus => ({
  order_id: payload.orderId,
  order_code: payload.orderCode,
  order_status: payload.orderStatus,
  payment_status: payload.paymentStatus,
  payment_method: payload.paymentMethod,
  paid_at: payload.paidAt ?? null,
  message: payload.message ?? "",
});

const mapOrder = (payload: any): Order => ({
  id: payload.id,
  user_id: payload.userId,
  status: payload.status,
  subtotal: Number(payload.subtotal ?? 0),
  tax: Number(payload.tax ?? 0),
  shipping_method_id: payload.shippingMethodId ?? null,
  shipping_method_name: payload.shippingMethodName ?? null,
  shipping_fee: Number(payload.shippingFee ?? 0),
  discount: Number(payload.discount ?? 0),
  total: Number(payload.total ?? 0),
  payment_status: payload.paymentStatus,
  payment_method: payload.paymentMethod ?? "COD",
  next_action: payload.nextAction ?? "NONE",
  payment: mapPaymentInstruction(payload.payment),
  order_no: payload.orderNo,
  created_at: payload.createdAt,
  updated_at: payload.updatedAt,
  address: payload.address ? mapOrderAddress(payload.address) : undefined,
  items: Array.isArray(payload.items) ? payload.items.map(mapOrderItem) : [],
});

const mapQuote = (payload: any): OrderQuote => ({
  subtotal: Number(payload.subtotal ?? 0),
  tax: Number(payload.tax ?? 0),
  shipping_method_id: payload.shippingMethodId ?? null,
  shipping_method_name: payload.shippingMethodName ?? null,
  shipping_fee: Number(payload.shippingFee ?? 0),
  discount: Number(payload.discount ?? 0),
  total: Number(payload.total ?? 0),
  payment_method: payload.paymentMethod ?? "COD",
  coupon: payload.coupon ? mapQuoteCoupon(payload.coupon) : null,
});

const toApiPayload = (orderData: OrderInput | OrderQuoteInput) => ({
  addressId: orderData.address_id ?? null,
  couponCode: orderData.coupon_code ?? null,
  paymentMethod: orderData.payment_method ?? "COD",
  shippingMethodId: orderData.shipping_method_id ?? null,
  items: orderData.items.map((item) => ({
    productId: item.product_id,
    variantId: item.variant_id ?? null,
    quantity: item.quantity,
  })),
});

const getOrders = async () => {
  const data = await apiClient.get<any[]>("/commerce/orders/mine");
  return data.map(mapOrder);
};

const getPaymentMethods = async (): Promise<PaymentMethod[]> => {
  const data = await apiClient.get<{ methods: any[] }>("/payment-methods");
  return (data.methods ?? [])
    .map(mapPaymentMethod)
    .sort((left, right) => left.priority - right.priority);
};

const getShippingMethods = async (): Promise<ShippingMethod[]> => {
  const data = await apiClient.get<{ methods: any[] }>("/shipping-methods");
  return (data.methods ?? []).map(mapShippingMethod);
};

const getOrderById = async (id: number): Promise<Order> => {
  const cachedOrder = orderCache.get(id);
  if (cachedOrder) {
    return cachedOrder;
  }

  const data = await apiClient.get<any>(`/commerce/orders/${id}`);
  const mapped = mapOrder(data);
  orderCache.set(id, mapped);
  return mapped;
};

const refreshOrderById = async (id: number): Promise<Order> => {
  const data = await apiClient.get<any>(`/commerce/orders/${id}`);
  const mapped = mapOrder(data);
  orderCache.set(id, mapped);
  return mapped;
};

const getPaymentStatus = async (orderId: number): Promise<PaymentStatus> => {
  const data = await apiClient.get<any>(
    `/commerce/orders/${orderId}/payment-status`,
  );
  return mapPaymentStatus(data);
};

const getOrdersByUser = async (_userId: string) => {
  const data = await apiClient.get<any[]>("/commerce/orders/mine");
  return data.map(mapOrder);
};

const getOrdersByStatus = async (status: string) => {
  const data = await apiClient.get<any[]>(
    `/commerce/orders/seller?status=${encodeURIComponent(status)}`,
  );
  return data.map(mapOrder);
};

const getOrdersBySellerAndStatus = async (
  _sellerId: string,
  status: string,
) => {
  const data = await apiClient.get<any[]>(
    `/commerce/orders/seller?status=${encodeURIComponent(status)}`,
  );
  return data.map(mapOrder);
};

const getAllOrdersBySeller = async (_sellerId: string) => {
  const data = await apiClient.get<any[]>("/commerce/orders/seller");
  return data.map(mapOrder);
};

const quoteOrder = async (orderData: OrderQuoteInput): Promise<OrderQuote> => {
  const data = await apiClient.post<any>(
    "/commerce/orders/quote",
    toApiPayload(orderData),
  );
  return mapQuote(data);
};

const createOrder = async (orderData: OrderInput) => {
  const data = await apiClient.post<any>(
    "/commerce/orders",
    toApiPayload(orderData),
  );
  const mapped = mapOrder(data);
  orderCache.set(mapped.id, mapped);
  return mapped;
};

const updateOrder = async (
  id: number,
  orderData: Partial<{
    status: string;
  }>,
) => {
  const data = await apiClient.patch<any>(`/commerce/orders/${id}/status`, {
    status: orderData.status,
  });
  const mapped = mapOrder(data);
  orderCache.delete(id);
  return mapped;
};

const deleteOrder = async (id: number) => {
  orderCache.delete(id);
  return false;
};

const orderService = {
  getOrders,
  getPaymentMethods,
  getShippingMethods,
  getOrderById,
  refreshOrderById,
  getPaymentStatus,
  getOrdersByUser,
  getOrdersByStatus,
  getOrdersBySellerAndStatus,
  getAllOrdersBySeller,
  quoteOrder,
  createOrder,
  updateOrder,
  deleteOrder,
};

export { orderService };
