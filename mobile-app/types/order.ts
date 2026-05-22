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
  shipping_method_id?: number | null;
  shipping_method_name?: string | null;
  discount: number;
  total: number;
  payment_method: string;
  coupon?: OrderQuoteCoupon | null;
};

export type ShippingMethod = {
  id: number;
  name: string;
  description?: string | null;
  estimated_min_days?: number | null;
  estimated_max_days?: number | null;
  fee: number;
  active: boolean;
};

export type PaymentMethod = {
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  type: "OFFLINE" | "ONLINE" | string;
  priority: number;
  features: string[];
};

export type PaymentInstruction = {
  payment_id: number;
  status: string;
  amount: number;
  currency: string;
  invoice_number?: string | null;
  qr_code_url?: string | null;
  qr_image_base64?: string | null;
  qr_content?: string | null;
  transfer_content?: string | null;
  bank_name?: string | null;
  bank_code?: string | null;
  bank_bin?: string | null;
  bank_account_number?: string | null;
  account_name?: string | null;
  bank_deep_link?: string | null;
  checkout_url?: string | null;
  expired_at?: string | null;
};

export type PaymentStatus = {
  order_id: number;
  order_code: string;
  order_status: string;
  payment_status: string;
  payment_method: string;
  paid_at?: string | null;
  message: string;
};

export type VietQrBankApp = {
  app_id: string;
  app_name: string;
  bank_name: string;
  app_logo?: string | null;
  monthly_install?: number | null;
  deeplink: string;
  autofill: boolean;
  installed?: boolean;
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
  flash_sale_campaign_id?: number;
  flash_sale_item_id?: number;
  flash_sale_reservation_token?: string;
};

export type OrderInput = {
  address_id: number;
  coupon_code?: string;
  payment_method?: string;
  shipping_method_id?: number | null;
  client_request_id?: string;
  items: OrderLineInput[];
};

export type OrderQuoteInput = {
  address_id?: number | null;
  coupon_code?: string;
  payment_method?: string;
  shipping_method_id?: number | null;
  items: OrderLineInput[];
};

export type Order = {
  id: number;
  user_id: string;
  status: string;
  subtotal: number;
  tax: number;
  shipping_fee: number;
  shipping_method_id?: number | null;
  shipping_method_name?: string | null;
  discount: number;
  total: number;
  payment_status?: string;
  payment_method?: string;
  next_action?: string;
  payment?: PaymentInstruction | null;
  order_no?: string;
  created_at: string;
  updated_at: string;
  address?: OrderAddressSnapshot | null;
  items?: OrderItem[];
};
