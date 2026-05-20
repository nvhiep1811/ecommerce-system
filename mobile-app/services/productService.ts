import { apiClient } from "@/services/apiClient";
import {
  FavouriteItem,
  Product,
  ProductReview,
  ReviewInput,
} from "@/types/product";
import { User } from "@/types/user";
import { Platform } from "react-native";

const productCache = new Map<number, Product>();

type ProductImageUploadAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

type ProductImageUploadResponse = {
  objectPath: string;
  publicUrl: string;
};

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

const mapSeller = (payload: any): Pick<User, "id" | "full_name"> | null => {
  const seller = payload?.seller ?? payload?.user ?? null;
  if (!seller) {
    return null;
  }

  return {
    id: seller.id ?? seller.userId ?? "",
    full_name: seller.fullName ?? seller.full_name ?? null,
  };
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
  review_count: Number(payload.reviewCount ?? payload.review_count ?? 0),
  brand: payload.brand ?? null,
  seller_id: payload.sellerId ?? payload.seller_id ?? null,
  seller_name:
    payload.sellerName ??
    payload.seller_name ??
    payload.sellerFullName ??
    payload.seller_full_name ??
    payload.seller?.fullName ??
    payload.seller?.full_name ??
    null,
  seller: mapSeller(payload),
  created_at: payload.createdAt,
});

const mapFavouriteItem = (payload: any): FavouriteItem => ({
  id: payload.id,
  product: mapProduct(payload.product),
  created_at: payload.createdAt,
});

const mapReview = (payload: any): ProductReview => ({
  id: payload.id,
  user_id: payload.userId,
  product_id: payload.productId,
  order_item_id: payload.orderItemId ?? null,
  rating: Number(payload.rating ?? 0),
  comment: payload.comment ?? null,
  image_urls: Array.isArray(payload.imageUrls) ? payload.imageUrls : [],
  verified_purchase: Boolean(payload.verifiedPurchase),
  status: payload.status ?? "visible",
  created_at: payload.createdAt,
  updated_at: payload.updatedAt,
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

const refreshProductById = async (id: number): Promise<Product> => {
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
  const result = await getProductsPage({
    featured: true,
    page: 0,
    size: limit,
    sort: "rating",
    direction: "desc",
  });
  return result.items;
};

const getFavourites = async (): Promise<FavouriteItem[]> => {
  const data = await apiClient.get<{ items: any[] }>("/catalog/favourites");
  return (data.items ?? []).map(mapFavouriteItem);
};

const getFavouriteStatus = async (productId: number): Promise<boolean> => {
  const data = await apiClient.get<any>(`/catalog/favourites/${productId}`);
  return Boolean(data.favourite);
};

const addFavourite = async (productId: number): Promise<FavouriteItem> => {
  const data = await apiClient.post<any>(`/catalog/favourites/${productId}`, {});
  return mapFavouriteItem(data);
};

const removeFavourite = async (productId: number): Promise<void> => {
  await apiClient.delete<void>(`/catalog/favourites/${productId}`);
};

const getProductReviews = async (productId: number): Promise<ProductReview[]> => {
  const data = await apiClient.get<{ items: any[] }>(
    `/catalog/reviews/products/${productId}`,
  );
  return (data.items ?? []).map(mapReview);
};

const getMyReviews = async (): Promise<ProductReview[]> => {
  const data = await apiClient.get<{ items: any[] }>("/catalog/reviews/mine");
  return (data.items ?? []).map(mapReview);
};

const submitReview = async (input: ReviewInput): Promise<ProductReview> => {
  const data = await apiClient.post<any>("/catalog/reviews", {
    productId: input.product_id,
    orderItemId: input.order_item_id,
    rating: input.rating,
    comment: input.comment ?? null,
    imageUrls: input.image_urls ?? [],
  });
  productCache.delete(input.product_id);
  return mapReview(data);
};

const uploadProductImage = async (asset: ProductImageUploadAsset) => {
  const fileName = asset.fileName || `product-image-${Date.now()}.jpg`;
  const mimeType = asset.mimeType || "image/jpeg";
  const formData = new FormData();

  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    (formData as any).append("file", blob, fileName);
  } else {
    (formData as any).append("file", {
      uri: asset.uri,
      name: fileName,
      type: mimeType,
    });
  }

  const data = await apiClient.uploadMultipart<ProductImageUploadResponse>(
    "/catalog/products/images",
    formData,
  );
  return data.publicUrl;
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
  productCache.clear();
  return mapProduct(data);
};

const productService = {
  getProducts,
  getProductsPage,
  getSellerProducts,
  getProductById,
  refreshProductById,
  getCategories,
  getSubCategories,
  getSubCategoriesByCategory,
  getProductsByCategory,
  getProductsBySubCategory,
  searchProducts,
  searchProductsPage,
  getFeaturedProducts,
  getFavourites,
  getFavouriteStatus,
  addFavourite,
  removeFavourite,
  getProductReviews,
  getMyReviews,
  submitReview,
  uploadProductImage,
  addProduct,
  updateProduct,
};

export { productService };
