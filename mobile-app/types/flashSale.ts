export type FlashSaleItem = {
  campaign_id: number;
  campaign_name: string;
  starts_at: string;
  ends_at: string;
  item_id: number;
  product_id: number;
  variant_id?: number | null;
  product_name: string;
  product_thumbnail?: string | null;
  original_price: number;
  sale_price: number;
  stock_limit: number;
  reserved_count: number;
  sold_count: number;
  remaining_stock: number;
  per_user_limit: number;
  status: string;
};

export type FlashSaleClaimResult = {
  campaign_id: number;
  item_id: number;
  status: string;
  reservation_token: string;
  quantity: number;
  remaining_stock: number;
  expires_at: string;
  message: string;
};
