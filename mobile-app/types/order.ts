import { Address } from './address';

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
  address?: Address | null;
  items?: OrderItem[];
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
