import { apiClient } from '@/services/apiClient';
import { Product } from '@/types/product';

const productCache = new Map<number, Product>();

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
  const data = await apiClient.get<any[]>('/catalog/products');
  return data.map(mapProduct);
};

const getProductById = async (id: number): Promise<Product> => {
  const cachedProduct = productCache.get(id);
  if (cachedProduct) {
    console.log(`Product ${id} loaded from cache`);
    return cachedProduct;
  }

  const data = await apiClient.get<any>(`/catalog/products/${id}`);
  const mapped = mapProduct(data);
  productCache.set(id, mapped);
  return mapped;
};

const getCategories = async () => {
  return apiClient.get<any[]>('/catalog/categories');
};

const getSubCategories = async () => {
  return apiClient.get<any[]>('/catalog/categories');
};

const getSubCategoriesByCategory = async (categoryId: number) => {
  return apiClient.get<any[]>(`/catalog/categories?parentId=${categoryId}`);
};

const getProductsByCategory = async (categoryId: number) => {
  const data = await apiClient.get<any[]>(`/catalog/products?categoryId=${categoryId}`);
  return data.map(mapProduct);
};

const getProductsBySubCategory = async (subCategoryId: number) => {
  const data = await apiClient.get<any[]>(`/catalog/products?categoryId=${subCategoryId}`);
  return data.map(mapProduct);
};

const searchProducts = async (query: string) => {
  const data = await apiClient.get<any[]>(`/catalog/products?search=${encodeURIComponent(query)}`);
  return data.map(mapProduct);
};

const getFeaturedProducts = async (limit: number = 10) => {
  const data = await apiClient.get<any[]>('/catalog/products?featured=true');
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
  id?: number; // Optional id in case it's passed, but we won't use it
}) => {
  const data = await apiClient.post<any>('/catalog/products', {
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

const updateProduct = async (id: number, productData: {
  name: string;
  description: string;
  price: number;
  sub_category_id: number;
  stock: number;
  unit?: string;
  thumbnail?: string;
}) => {
  const data = await apiClient.put<any>(`/catalog/products/${id}`, {
    name: productData.name,
    description: productData.description,
    price: productData.price,
    subCategoryId: productData.sub_category_id,
    stock: productData.stock,
    unit: productData.unit || null,
    thumbnail: productData.thumbnail || null,
  });
  productCache.delete(id);
  return mapProduct(data);
};

const productService = {
  getProducts,
  getProductById,
  getCategories,
  getSubCategories,
  getSubCategoriesByCategory,
  getProductsByCategory,
  getProductsBySubCategory,
  searchProducts,
  getFeaturedProducts,
  addProduct,
  updateProduct,
};

export { productService };

