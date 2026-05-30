import { apiClient } from "./apiClient";
import type {
  Category,
  Coupon,
  CouponPayload,
  Product,
  ProductPage,
  ProductUpsertPayload,
  CategoryPayload,
} from "../types/api";

type ProductPageParams = {
  page?: number;
  size?: number;
  search?: string;
  categoryId?: number | null;
  sellerId?: string | null;
  sort?: string;
  direction?: "asc" | "desc";
};

type ProductResponsePayload = {
  id: number;
  subCategoryId?: number | null;
  name?: string;
  description?: string;
  thumbnail?: string | null;
  price?: number | string | null;
  stock?: number | string | null;
  unit?: string | null;
  rating?: number | string | null;
  reviewCount?: number | string | null;
  brand?: string | null;
  createdAt?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
};

type ProductPageResponsePayload = {
  items?: ProductResponsePayload[];
  page?: number;
  size?: number;
  totalItems?: number;
  totalPages?: number;
  hasNext?: boolean;
};

type CouponResponsePayload = {
  id: number;
  code?: string;
  description?: string | null;
  discountType?: string;
  discountValue?: number | string | null;
  minOrderValue?: number | string | null;
  maxDiscount?: number | string | null;
  startAt?: string | null;
  endAt?: string | null;
  usageLimit?: number | null;
  usedCount?: number | string | null;
  active?: boolean;
  createdAt?: string | null;
};

const toNumber = (value: unknown, fallback = 0) => Number(value ?? fallback);

const mapProduct = (payload: ProductResponsePayload): Product => ({
  id: payload.id,
  subCategoryId: payload.subCategoryId ?? null,
  name: payload.name ?? "",
  description: payload.description ?? "",
  thumbnail: payload.thumbnail ?? null,
  price: toNumber(payload.price),
  stock: toNumber(payload.stock),
  unit: payload.unit ?? null,
  rating: toNumber(payload.rating),
  reviewCount: toNumber(payload.reviewCount),
  brand: payload.brand ?? null,
  createdAt: payload.createdAt ?? null,
  sellerId: payload.sellerId ?? null,
  sellerName: payload.sellerName ?? null,
});

const mapCoupon = (payload: CouponResponsePayload): Coupon => ({
  id: payload.id,
  code: payload.code ?? "",
  description: payload.description ?? null,
  discountType: payload.discountType ?? "fixed",
  discountValue: toNumber(payload.discountValue),
  minOrderValue: toNumber(payload.minOrderValue),
  maxDiscount: payload.maxDiscount == null ? null : toNumber(payload.maxDiscount),
  startAt: payload.startAt ?? null,
  endAt: payload.endAt ?? null,
  usageLimit: payload.usageLimit ?? null,
  usedCount: toNumber(payload.usedCount),
  active: Boolean(payload.active),
  createdAt: payload.createdAt ?? null,
});

const query = (params: Record<string, string | number | null | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  });
  return searchParams.toString();
};

export const catalogService = {
  async getProductsPage({
    page = 0,
    size = 10,
    search = "",
    categoryId = null,
    sellerId = null,
    sort = "createdAt",
    direction = "desc",
  }: ProductPageParams = {}): Promise<ProductPage> {
    const data = await apiClient.get<ProductPageResponsePayload>(
      `/catalog/products/page?${query({
        page,
        size,
        search: search.trim(),
        categoryId,
        sellerId,
        sort,
        direction,
      })}`,
    );

    return {
      items: Array.isArray(data.items) ? data.items.map(mapProduct) : [],
      page: toNumber(data.page, page),
      size: toNumber(data.size, size),
      totalItems: toNumber(data.totalItems),
      totalPages: toNumber(data.totalPages),
      hasNext: Boolean(data.hasNext),
    };
  },
  async getProducts(): Promise<Product[]> {
    const data = await apiClient.get<ProductResponsePayload[]>("/catalog/products");
    return data.map(mapProduct);
  },
  async getCategories(parentId?: number | null): Promise<Category[]> {
    const suffix = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
    return apiClient.get<Category[]>(`/catalog/categories${suffix}`);
  },
  async getCategory(id: number): Promise<Category> {
    return apiClient.get<Category>(`/catalog/categories/${id}`);
  },
  async createCategory(payload: CategoryPayload): Promise<Category> {
    return apiClient.post<Category>("/catalog/categories", payload);
  },
  async updateCategory(id: number, payload: CategoryPayload): Promise<Category> {
    return apiClient.put<Category>(`/catalog/categories/${id}`, payload);
  },
  async deleteCategory(id: number): Promise<void> {
    return apiClient.delete<void>(`/catalog/categories/${id}`);
  },
  async createProduct(payload: ProductUpsertPayload): Promise<Product> {
    const data = await apiClient.post<ProductResponsePayload>("/catalog/products", payload);
    return mapProduct(data);
  },
  async updateProduct(id: number, payload: ProductUpsertPayload): Promise<Product> {
    const data = await apiClient.put<ProductResponsePayload>(`/catalog/products/${id}`, payload);
    return mapProduct(data);
  },
  async getCoupons(): Promise<Coupon[]> {
    const data = await apiClient.get<CouponResponsePayload[]>("/catalog/coupons");
    return data.map(mapCoupon);
  },
  async createCoupon(payload: Required<Pick<CouponPayload, "code">> & CouponPayload) {
    const data = await apiClient.post<CouponResponsePayload>("/catalog/coupons", payload);
    return mapCoupon(data);
  },
  async updateCoupon(id: number, payload: CouponPayload) {
    const data = await apiClient.put<CouponResponsePayload>(`/catalog/coupons/${id}`, payload);
    return mapCoupon(data);
  },
  async deleteCoupon(id: number) {
    await apiClient.delete<void>(`/catalog/coupons/${id}`);
  },
};
