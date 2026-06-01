import { apiClient } from "@/services/apiClient";
import {
  Coupon,
  CreateCouponRequest,
  UpdateCouponRequest,
} from "@/types/coupons";

const couponCache = new Map<string, Coupon>();

const mapCoupon = (payload: any): Coupon => ({
  id: payload.id,
  code: payload.code,
  description: payload.description,
  discount_type: payload.discountType,
  discount_value: Number(payload.discountValue ?? 0),
  min_order_value: Number(payload.minOrderValue ?? 0),
  max_discount: payload.maxDiscount ? Number(payload.maxDiscount) : undefined,
  start_date: payload.startAt,
  end_date: payload.endAt,
  usage_limit: payload.usageLimit ?? undefined,
  used_count: payload.usedCount ?? 0,
  active: payload.active,
  created_at: payload.createdAt,
  endAt: ""
});

// --- API DÀNH CHO CUSTOMER (GIAO DIỆN MUA SẮM) ---

const getCoupons = async (): Promise<Coupon[]> => {
  const data = await apiClient.get<any[]>("/catalog/coupons");
  return data.map(mapCoupon);
};

const getCouponByCode = async (code: string): Promise<Coupon | null> => {
  if (couponCache.has(code)) {
    return couponCache.get(code)!;
  }

  const coupons = await getCoupons();
  const found =
    coupons.find(
      (coupon) => coupon.code.toUpperCase() === code.toUpperCase(),
    ) ?? null;
  if (found) {
    couponCache.set(code, found);
  }
  return found;
};

const validateCoupon = async (
  code: string,
  orderValue: number,
): Promise<{
  valid: boolean;
  discount: number;
  message: string;
  coupon?: Coupon;
}> => {
  const response = await apiClient.post<any>("/catalog/coupons/validate", {
    code,
    orderValue,
  });

  return {
    valid: response.valid,
    discount: Number(response.discount ?? 0),
    message: response.message,
    coupon: response.coupon ? mapCoupon(response.coupon) : undefined,
  };
};

const applyCoupon = async (_couponId: number): Promise<boolean> => {
  couponCache.clear();
  return true;
};

// --- API DÀNH CHO SELLER (QUẢN LÝ VOUCHER) ---

const getCouponById = async (id: number): Promise<Coupon> => {
  const data = await apiClient.get<any>(`/catalog/coupons/${id}`);
  return mapCoupon(data);
};

const createCoupon = async (payload: CreateCouponRequest): Promise<Coupon> => {
  const data = await apiClient.post<any>("/catalog/coupons", payload);
  return mapCoupon(data);
};

const updateCoupon = async (
  id: number,
  payload: UpdateCouponRequest,
): Promise<Coupon> => {
  const data = await apiClient.put<any>(`/catalog/coupons/${id}`, payload);
  return mapCoupon(data);
};

const deleteCoupon = async (id: number): Promise<void> => {
  await apiClient.delete(`/catalog/coupons/${id}`);
};

export const couponService = {
  getCoupons,
  getCouponByCode,
  validateCoupon,
  applyCoupon,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
