import { apiClient } from "@/services/apiClient";
import {
  Order,
  OrderAddressSnapshot,
  OrderInput,
  OrderItem,
  OrderQuote,
  OrderQuoteCoupon,
  OrderQuoteInput,
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

const mapOrder = (payload: any): Order => ({
  id: payload.id,
  user_id: payload.userId,
  status: payload.status,
  subtotal: Number(payload.subtotal ?? 0),
  tax: Number(payload.tax ?? 0),
  shipping_fee: Number(payload.shippingFee ?? 0),
  discount: Number(payload.discount ?? 0),
  total: Number(payload.total ?? 0),
  payment_status: payload.paymentStatus,
  order_no: payload.orderNo,
  created_at: payload.createdAt,
  updated_at: payload.updatedAt,
  address: payload.address ? mapOrderAddress(payload.address) : undefined,
  items: Array.isArray(payload.items) ? payload.items.map(mapOrderItem) : [],
});

const mapQuote = (payload: any): OrderQuote => ({
  subtotal: Number(payload.subtotal ?? 0),
  tax: Number(payload.tax ?? 0),
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
  getOrderById,
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
