export type Coupon = {
  endAt: string | number | Date;
  id: number;
  code: string;
  description?: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_value?: number;
  max_discount?: number;
  start_date: string;
  end_date: string;
  usage_limit?: number;
  used_count?: number;
  active: boolean;
  created_at: string;
};

export type CreateCouponRequest = {
  code: string;
  description?: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number;
  startAt?: string; // ISO String (OffsetDateTime)
  endAt?: string;   // ISO String (OffsetDateTime)
  usageLimit?: number;
  active: boolean;
};

export type UpdateCouponRequest = Partial<Omit<CreateCouponRequest, "code">>;