import { Product, ProductVariant } from "./product";

export interface CartItem {
  product: Product;
  variant?: ProductVariant | null;
  quantity: number;
}
