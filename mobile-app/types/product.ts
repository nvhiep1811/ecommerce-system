import { User } from "@/types/user";

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
  brand: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  seller?: Pick<User, "id" | "full_name"> | null;
  created_at?: string;
};
