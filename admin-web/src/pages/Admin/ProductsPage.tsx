import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Panel, PanelHeader, EmptyState } from "../../components/admin/Panel";
import StatusBadge from "../../components/admin/StatusBadge";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import Button from "../../components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useAuth } from "../../hooks/useAuth";
import { catalogService } from "../../services/catalogService";
import type { Category, Product, ProductUpsertPayload } from "../../types/api";
import { formatCurrency, formatDateTime, formatNumber } from "../../utils/format";

type ProductForm = {
  id?: number;
  name: string;
  description: string;
  price: string;
  subCategoryId: string;
  stock: string;
  thumbnail: string;
  unit: string;
};

const emptyForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  subCategoryId: "",
  stock: "",
  thumbnail: "",
  unit: "",
};

const roleOf = (role?: string | null) => role?.toLowerCase() ?? "";

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSeller = roleOf(user?.role) === "seller";
  const canWriteProducts = isSeller;

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.id) ?? null,
    [form.id, products],
  );

  const loadProducts = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await catalogService.getProductsPage({
        page: nextPage,
        size: 10,
        search,
        sellerId: isSeller ? user?.id : null,
      });
      setProducts(result.items);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotalItems(result.totalItems);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được sản phẩm");
    } finally {
      setLoading(false);
    }
  }, [isSeller, search, user?.id]);

  useEffect(() => {
    void catalogService.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts(0);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const updateForm = (key: keyof ProductForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const editProduct = (product: Product) => {
    setMessage(null);
    setError(null);
    setForm({
      id: product.id,
      name: product.name,
      description: product.description,
      price: String(product.price),
      subCategoryId: product.subCategoryId ? String(product.subCategoryId) : "",
      stock: String(product.stock),
      thumbnail: product.thumbnail ?? "",
      unit: product.unit ?? "",
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setMessage(null);
    setError(null);
  };

  const toPayload = (): ProductUpsertPayload => ({
    name: form.name.trim(),
    description: form.description.trim(),
    price: Number(form.price),
    subCategoryId: Number(form.subCategoryId),
    stock: Number(form.stock),
    unit: form.unit.trim() || null,
    thumbnail: form.thumbnail.trim() || null,
  });

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = toPayload();
      if (form.id) {
        await catalogService.updateProduct(form.id, payload);
        setMessage("Đã cập nhật sản phẩm.");
      } else {
        await catalogService.createProduct(payload);
        setMessage("Đã tạo sản phẩm mới.");
      }
      setForm(emptyForm);
      await loadProducts(page);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không lưu được sản phẩm");
    } finally {
      setSaving(false);
    }
  };

  const goToPage = (nextPage: number) => {
    void loadProducts(Math.max(0, nextPage));
  };

  return (
    <>
      <PageMeta title="Products | Ecommerce Admin" description="Product management" />
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-title-sm font-bold text-gray-800 dark:text-white/90">Sản phẩm</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formatNumber(totalItems)} sản phẩm trong catalog hiện tại
            </p>
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên sản phẩm"
            className="sm:w-80"
          />
        </div>

        {!canWriteProducts ? (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-orange-300">
            Backend hiện yêu cầu role SELLER cho thao tác tạo và sửa sản phẩm.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-300">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-300">
            {message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2">
            <PanelHeader title="Danh sách sản phẩm" description="Nguồn: /api/catalog/products/page" />
            {loading ? (
              <EmptyState>Đang tải sản phẩm...</EmptyState>
            ) : products.length ? (
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                    <TableRow>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Sản phẩm
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Giá
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Tồn kho
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Seller
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Ngày tạo
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium text-gray-500">
                        Thao tác
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                              {product.thumbnail ? (
                                <img src={product.thumbnail} alt={product.name} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 dark:text-white/90">{product.name}</p>
                              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                                Rating {product.rating} ({product.reviewCount})
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatCurrency(product.price)}
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          <StatusBadge status={product.stock > 0 ? `${product.stock}` : "disabled"} />
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {product.sellerName ?? product.sellerId ?? "N/A"}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatDateTime(product.createdAt)}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-end">
                          <button
                            type="button"
                            onClick={() => editProduct(product)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                          >
                            Sửa
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 dark:border-gray-800">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Trang {page + 1} / {Math.max(totalPages, 1)}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => goToPage(page - 1)}>
                      Trước
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page + 1 >= totalPages}
                      onClick={() => goToPage(page + 1)}
                    >
                      Sau
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState>Không có sản phẩm nào.</EmptyState>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title={selectedProduct ? "Sửa sản phẩm" : "Tạo sản phẩm"}
              description="Payload khớp ProductUpsertRequest"
            />
            <form className="space-y-4 p-5" onSubmit={saveProduct}>
              <div>
                <Label>Tên sản phẩm</Label>
                <Input value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
              </div>
              <div>
                <Label>Mô tả</Label>
                <TextArea value={form.description} onChange={(value) => updateForm("description", value)} rows={4} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Giá</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(event) => updateForm("price", event.target.value)}
                  />
                </div>
                <div>
                  <Label>Tồn kho</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(event) => updateForm("stock", event.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Danh mục</Label>
                <select
                  value={form.subCategoryId}
                  onChange={(event) => updateForm("subCategoryId", event.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="">Chọn danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Ảnh thumbnail URL</Label>
                <Input value={form.thumbnail} onChange={(event) => updateForm("thumbnail", event.target.value)} />
              </div>
              <div>
                <Label>Đơn vị</Label>
                <Input value={form.unit} onChange={(event) => updateForm("unit", event.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button type="submit" size="sm" disabled={!canWriteProducts || saving}>
                  {saving ? "Đang lưu..." : selectedProduct ? "Cập nhật" : "Tạo mới"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                  Làm mới
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
