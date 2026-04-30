import { apiClient } from "@/services/apiClient";
import { Product } from "@/types/product";

const productCache = new Map<number, Product>();

export type ProductPage = {
  items: Product[];
  page: number;
  size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
};

export type ProductPageParams = {
  page?: number;
  size?: number;
  category_id?: number | null;
  seller_id?: string | null;
  search?: string | null;
  featured?: boolean;
  sort?: "createdAt" | "price" | "rating" | string;
  direction?: "asc" | "desc";
};

const mapProduct = (payload: any): Product => ({
  id: payload.id,
  sub_category_id: payload.subCategoryId,
  name: payload.name,
  description: payload.description,
  thumbnail: payload.thumbnail,
  price: Number(payload.price ?? 0),
  stock: payload.stock ?? 0,
  unit: payload.unit ?? null,
  rating: Number(payload.rating ?? 0),
  brand: payload.brand ?? null,
  created_at: payload.createdAt,
});

const getProducts = async () => {
  const data = await apiClient.get<any[]>("/catalog/products");
  return data.map(mapProduct);
};

const getProductsPage = async ({
  page = 0,
  size = 10,
  category_id,
  seller_id,
  search,
  featured,
  sort = "createdAt",
  direction = "desc",
}: ProductPageParams = {}): Promise<ProductPage> => {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
    sort,
    direction,
  });

  if (category_id) {
    params.set("categoryId", String(category_id));
  }
  if (seller_id) {
    params.set("sellerId", seller_id);
  }
  if (search?.trim()) {
    params.set("search", search.trim());
  }
  if (featured) {
    params.set("featured", "true");
  }

  const data = await apiClient.get<any>(`/catalog/products/page?${params}`);
  return {
    items: Array.isArray(data.items) ? data.items.map(mapProduct) : [],
    page: Number(data.page ?? page),
    size: Number(data.size ?? size),
    total_items: Number(data.totalItems ?? 0),
    total_pages: Number(data.totalPages ?? 0),
    has_next: Boolean(data.hasNext),
  };
};

const getSellerProducts = async (sellerId: string) => {
  const data = await apiClient.get<any[]>(
    `/catalog/products?sellerId=${encodeURIComponent(sellerId)}`,
  );
  return data.map(mapProduct);
};

const getProductById = async (id: number): Promise<Product> => {
  const cachedProduct = productCache.get(id);
  if (cachedProduct) {
    return cachedProduct;
  }

  const data = await apiClient.get<any>(`/catalog/products/${id}`);
  const mapped = mapProduct(data);
  productCache.set(id, mapped);
  return mapped;
};

const getCategories = async () => {
  return apiClient.get<any[]>("/catalog/categories");
};

const getSubCategories = async () => {
  return apiClient.get<any[]>("/catalog/categories");
};

const getSubCategoriesByCategory = async (categoryId: number) => {
  return apiClient.get<any[]>(`/catalog/categories?parentId=${categoryId}`);
};

const getProductsByCategory = async (categoryId: number) => {
  const data = await apiClient.get<any[]>(
    `/catalog/products?categoryId=${categoryId}`,
  );
  return data.map(mapProduct);
};

const getProductsBySubCategory = async (subCategoryId: number) => {
  const data = await apiClient.get<any[]>(
    `/catalog/products?categoryId=${subCategoryId}`,
  );
  return data.map(mapProduct);
};

const searchProducts = async (query: string) => {
  const data = await apiClient.get<any[]>(
    `/catalog/products?search=${encodeURIComponent(query)}`,
  );
  return data.map(mapProduct);
};

const searchProductsPage = async (
  query: string,
  page: number = 0,
  size: number = 10,
) => getProductsPage({ search: query, page, size, sort: "createdAt", direction: "desc" });

const getFeaturedProducts = async (limit: number = 10) => {
  const data = await apiClient.get<any[]>("/catalog/products?featured=true");
  return data.slice(0, limit).map(mapProduct);
};

const addProduct = async (productData: {
  name: string;
  description: string;
  price: number;
  sub_category_id: number;
  stock: number;
  unit?: string;
  thumbnail?: string;
  id?: number;
}) => {
  const data = await apiClient.post<any>("/catalog/products", {
    name: productData.name,
    description: productData.description,
    price: productData.price,
    subCategoryId: productData.sub_category_id,
    stock: productData.stock,
    unit: productData.unit || null,
    thumbnail: productData.thumbnail || null,
  });
  productCache.clear();
  return mapProduct(data);
};

const updateProduct = async (
  id: number,
  productData: {
    name: string;
    description: string;
    price: number;
    sub_category_id: number;
    stock: number;
    unit?: string;
    thumbnail?: string;
  },
) => {
  const data = await apiClient.put<any>(`/catalog/products/${id}`, {
    name: productData.name,
    description: productData.description,
    price: productData.price,
    subCategoryId: productData.sub_category_id,
    stock: productData.stock,
    unit: productData.unit || null,
    thumbnail: productData.thumbnail || null,
  });
  console.log(productData.thumbnail);
  productCache.clear();
  return mapProduct(data);
};

const productService = {
  getProducts,
  getProductsPage,
  getSellerProducts,
  getProductById,
  getCategories,
  getSubCategories,
  getSubCategoriesByCategory,
  getProductsByCategory,
  getProductsBySubCategory,
  searchProducts,
  searchProductsPage,
  getFeaturedProducts,
  addProduct,
  updateProduct,
};

export { productService };
