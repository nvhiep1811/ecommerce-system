import { apiClient } from '@/services/apiClient';
import { Address } from '@/types/address';
import { Order, OrderItem } from '@/types/order';

const orderCache = new Map<number, Order>();

const mapAddress = (payload: any): Address => ({
  id: payload?.id ?? 0,
  user_id: '',
  full_name: payload?.fullName ?? '',
  phone: payload?.phone ?? '',
  address_line: payload?.addressLine ?? '',
  city: payload?.city ?? '',
  province: payload?.province ?? '',
  postal_code: payload?.postalCode ?? '',
  is_default: false,
});

const mapOrderItem = (payload: any): OrderItem => ({
  id: payload.id,
  product_id: payload.productId,
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
  address: payload.address ? mapAddress(payload.address) : undefined,
  items: Array.isArray(payload.items) ? payload.items.map(mapOrderItem) : [],
});

const getOrders = async () => {
  const data = await apiClient.get<any[]>('/commerce/orders/mine');
  return data.map(mapOrder);
};

const getOrderById = async (id: number): Promise<Order> => {
  const cachedOrder = orderCache.get(id);
  if (cachedOrder) {
    console.log(`Order ${id} loaded from cache`);
    return cachedOrder;
  }

  const data = await apiClient.get<any>(`/commerce/orders/${id}`);
  const mapped = mapOrder(data);
  orderCache.set(id, mapped);
  return mapped;
};

const getOrdersByUser = async (userId: string) => {
  const data = await apiClient.get<any[]>('/commerce/orders/mine');
  return data.map(mapOrder);
};

const getOrdersByStatus = async (status: string) => {
  const data = await apiClient.get<any[]>(`/commerce/orders/seller?status=${encodeURIComponent(status)}`);
  return data.map(mapOrder);
};

const getOrdersBySellerAndStatus = async (sellerId: string, status: string) => {
  const data = await apiClient.get<any[]>(`/commerce/orders/seller?status=${encodeURIComponent(status)}`);
  return data.map(mapOrder);
};

const getAllOrdersBySeller = async (sellerId: string) => {
  const data = await apiClient.get<any[]>('/commerce/orders/seller');
  return data.map(mapOrder);
};

const createOrder = async (orderData: {
  address_id: number;
  coupon_code?: string;
  payment_method?: string;
  items: {
    product_id: number;
    variant_id?: number;
    quantity: number;
    price?: number;
  }[];
}) => {
  const data = await apiClient.post<any>('/commerce/orders', {
    addressId: orderData.address_id,
    couponCode: orderData.coupon_code ?? null,
    paymentMethod: orderData.payment_method ?? 'COD',
    items: orderData.items.map((item) => ({
      productId: item.product_id,
      variantId: item.variant_id ?? null,
      quantity: item.quantity,
    })),
  });
  const mapped = mapOrder(data);
  orderCache.set(mapped.id, mapped);
  return mapped;
};

const updateOrder = async (
  id: number,
  orderData: Partial<{
    status: string;
  }>
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
  createOrder,
  updateOrder,
  deleteOrder,
};
export { orderService };

