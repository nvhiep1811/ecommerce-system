export type OrderAddressSnapshot = {
  full_name: string;
  phone: string;
  address_line: string;
  city: string;
  province: string;
  postal_code: string;
};

export type OrderQuoteCoupon = {
  valid: boolean;
  discount: number;
  message: string;
  coupon?: {
    id: number;
    code: string;
  } | null;
};

export type OrderQuote = {
  subtotal: number;
  tax: number;
  shipping_fee: number;
  discount: number;
  total: number;
  payment_method: string;
  coupon?: OrderQuoteCoupon | null;
};

export type OrderItem = {
  id: number;
  product_id: number;
  variant_id?: number;
  quantity: number;
  price: number;
  products?: {
    id: number;
    name: string;
    thumbnail: string | null;
    price: number;
    description: string | null;
    stock: number;
  };
};

export type OrderLineInput = {
  product_id: number;
  variant_id?: number;
  quantity: number;
  price?: number;
};

export type OrderInput = {
  address_id: number;
  coupon_code?: string;
  payment_method?: string;
  items: OrderLineInput[];
};

export type OrderQuoteInput = {
  address_id?: number | null;
  coupon_code?: string;
  payment_method?: string;
  items: OrderLineInput[];
};

export type Order = {
  id: number;
  user_id: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping_fee: number;
  discount: number;
  total: number;
  payment_status?: string;
  order_no?: string;
  created_at: string;
  updated_at: string;
  address?: OrderAddressSnapshot | null;
  items?: OrderItem[];
};
