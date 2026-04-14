import { apiClient } from "@/services/apiClient";
import { Coupon } from "@/types/coupons";

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
  used_count: payload.usedCount ?? undefined,
  active: payload.active,
  created_at: payload.createdAt,
});

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

const applyCoupon = async (couponId: number): Promise<boolean> => {
  couponCache.clear();
  return true;
};

const couponService = {
  getCoupons,
  getCouponByCode,
  validateCoupon,
  applyCoupon,
};

export { couponService };
