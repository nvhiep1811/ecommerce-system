export type Coupon = {
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
