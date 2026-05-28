import { User } from "@/types/user";

export type ProductVariant = {
  id: number;
  sku: string | null;
  variant_name: string | null;
  combination: Record<string, unknown>;
  price: number;
  stock: number;
  thumbnail: string | null;
  active: boolean;
};

export type Product = {
  id: number;
  sub_category_id: number;
  name: string;
  description: string | null;
  thumbnail: string | null;
  price: number;
  stock: number;
  unit: string | null;
  rating: number;
  review_count: number;
  brand: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  seller?: Pick<User, "id" | "full_name"> | null;
  variants?: ProductVariant[];
  created_at?: string;
};

export type FavouriteItem = {
  id: number;
  product: Product;
  created_at: string;
};

export type ProductReview = {
  id: number;
  user_id: string;
  product_id: number;
  order_item_id: number | null;
  rating: number;
  comment: string | null;
  image_urls: string[];
  verified_purchase: boolean;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ReviewInput = {
  product_id: number;
  order_item_id: number;
  rating: number;
  comment?: string;
  image_urls?: string[];
};
