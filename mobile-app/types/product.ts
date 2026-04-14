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
  created_at?: string;
};
