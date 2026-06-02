import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Panel, PanelHeader, EmptyState } from "../../components/admin/Panel";
import StatusBadge from "../../components/admin/StatusBadge";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { catalogService } from "../../services/catalogService";
import { commerceService } from "../../services/commerceService";
import type {
  FlashSaleCampaign,
  FlashSaleCreatePayload,
  FlashSaleItem,
  Product,
} from "../../types/api";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
} from "../../utils/format";

type CampaignForm = {
  name: string;
  status: "active" | "scheduled" | "draft";
  startsAt: string;
  endsAt: string;
  preloadStock: boolean;
};

type CampaignItemForm = {
  productId: number;
  productName: string;
  productThumbnail: string | null;
  originalPrice: number;
  salePrice: string;
  stockLimit: string;
  perUserLimit: string;
  status: "active" | "scheduled";
};

const toLocalDateInput = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const createDefaultForm = (): CampaignForm => {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  return {
    name: `Flash Sale ${toLocalDateInput(startsAt).replace("T", " ")}`,
    status: "active",
    startsAt: toLocalDateInput(startsAt),
    endsAt: toLocalDateInput(endsAt),
    preloadStock: true,
  };
};

const toIso = (value: string) => new Date(value).toISOString();

export default function FlashSalesPage() {
  const [campaigns, setCampaigns] = useState<FlashSaleCampaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<CampaignForm>(() => createDefaultForm());
  const [items, setItems] = useState<CampaignItemForm[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preloadingKey, setPreloadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await commerceService.getFlashSaleCampaigns(20));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không tải được flash sale",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const result = await catalogService.getProductsPage({
        page: 0,
        size: 40,
        search: productSearch,
      });
      setProducts(result.items);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [productSearch]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id) === selectedProductId),
    [products, selectedProductId],
  );

  const activeCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => campaign.status.toLowerCase() === "active")
        .length,
    [campaigns],
  );

  const updateForm = <K extends keyof CampaignForm>(
    key: K,
    value: CampaignForm[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateItem = (
    productId: number,
    key: "salePrice" | "stockLimit" | "perUserLimit",
    value: string,
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, [key]: value } : item,
      ),
    );
  };

  const addSelectedProduct = () => {
    if (!selectedProduct) {
      return;
    }
    if (items.some((item) => item.productId === selectedProduct.id)) {
      setSelectedProductId("");
      return;
    }

    setItems((current) => [
      ...current,
      {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productThumbnail: selectedProduct.thumbnail,
        originalPrice: selectedProduct.price,
        salePrice: String(Math.max(1, Math.floor(selectedProduct.price * 0.9))),
        stockLimit: String(Math.max(0, Math.min(selectedProduct.stock, 100))),
        perUserLimit: "1",
        status: "active",
      },
    ]);
    setSelectedProductId("");
  };

  const removeItem = (productId: number) => {
    setItems((current) => current.filter((item) => item.productId !== productId));
  };

  const isPreloadable = (campaign: FlashSaleCampaign, item: FlashSaleItem) =>
    ["active", "scheduled"].includes(campaign.status.toLowerCase()) &&
    ["active", "scheduled"].includes(item.status.toLowerCase());

  const resetForm = () => {
    setForm(createDefaultForm());
    setItems([]);
    setSelectedProductId("");
    setError(null);
  };

  const toPayload = (): FlashSaleCreatePayload => ({
    name: form.name.trim(),
    status: form.status,
    startsAt: toIso(form.startsAt),
    endsAt: toIso(form.endsAt),
    preloadStock: form.preloadStock,
    items: items.map((item) => ({
      productId: item.productId,
      salePrice: Number(item.salePrice),
      stockLimit: Number(item.stockLimit),
      perUserLimit: Number(item.perUserLimit),
      status: item.status,
    })),
  });

  const saveCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!form.name.trim()) {
        throw new Error("Tên flash sale là bắt buộc");
      }
      const startsAtTime = new Date(form.startsAt).getTime();
      const endsAtTime = new Date(form.endsAt).getTime();
      if (!Number.isFinite(startsAtTime) || !Number.isFinite(endsAtTime)) {
        throw new Error("Thời gian flash sale chưa hợp lệ");
      }
      if (startsAtTime >= endsAtTime) {
        throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu");
      }
      if (!items.length) {
        throw new Error("Vui lòng chọn ít nhất một sản phẩm");
      }
      const payload = toPayload();
      const invalidItem = payload.items.find(
        (item) =>
          !Number.isFinite(item.salePrice) ||
          item.salePrice <= 0 ||
          !Number.isFinite(item.stockLimit) ||
          item.stockLimit < 0 ||
          !Number.isFinite(item.perUserLimit) ||
          item.perUserLimit < 1,
      );
      if (invalidItem) {
        throw new Error("Giá sale, số suất và giới hạn/user chưa hợp lệ");
      }
      await commerceService.createFlashSaleCampaign(payload);
      resetForm();
      setMessage(
        form.preloadStock
          ? "Đã tạo flash sale và preload stock vào Redis."
          : "Đã tạo flash sale. Cần preload stock trước khi mở bán.",
      );
      await loadCampaigns();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không tạo được flash sale",
      );
    } finally {
      setSaving(false);
    }
  };

  const preloadItem = async (
    campaign: FlashSaleCampaign,
    item: FlashSaleItem,
  ) => {
    const key = `${campaign.id}:${item.id}`;
    setPreloadingKey(key);
    setError(null);
    setMessage(null);

    try {
      const result = await commerceService.preloadFlashSaleItem(
        campaign.id,
        item.id,
        {
          stock: Math.max(0, item.remainingStock),
          perUserLimit: Math.max(1, item.perUserLimit),
        },
      );
      setMessage(
        `Đã preload Redis cho ${item.productName}: ${formatNumber(
          result.stock,
        )} suất, giới hạn ${formatNumber(result.perUserLimit)}/user.`,
      );
      await loadCampaigns();
    } catch (preloadError) {
      setError(
        preloadError instanceof Error
          ? preloadError.message
          : "Không preload được flash sale",
      );
    } finally {
      setPreloadingKey(null);
    }
  };

  return (
    <>
      <PageMeta
        title="Flash Sales | Mega Mall Admin"
        description="Flash sale campaign management"
      />
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-title-sm font-bold text-gray-800 dark:text-white/90">
              Flash sale
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {formatNumber(activeCampaigns)} campaign đang active trên tổng{" "}
              {formatNumber(campaigns.length)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadCampaigns()}>
            Làm mới
          </Button>
        </div>

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
            <PanelHeader
              title="Campaign gần đây"
              description="Hiển thị metadata PostgreSQL và projection đã bán/giữ chỗ"
            />
            {loading ? (
              <EmptyState>Đang tải flash sale...</EmptyState>
            ) : campaigns.length ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="space-y-4 p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="font-semibold text-gray-800 dark:text-white/90">
                            {campaign.name}
                          </h2>
                          <StatusBadge status={campaign.status} />
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {formatDateTime(campaign.startsAt)} →{" "}
                          {formatDateTime(campaign.endsAt)}
                        </p>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        #{campaign.id} · {campaign.items.length} sản phẩm
                      </span>
                    </div>

                    {campaign.items.length ? (
                      <div className="max-w-full overflow-x-auto">
                        <Table>
                          <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                            <TableRow>
                              <TableCell
                                isHeader
                                className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500"
                              >
                                Sản phẩm
                              </TableCell>
                              <TableCell
                                isHeader
                                className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500"
                              >
                                Giá sale
                              </TableCell>
                              <TableCell
                                isHeader
                                className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500"
                              >
                                Suất
                              </TableCell>
                              <TableCell
                                isHeader
                                className="px-4 py-3 text-start text-theme-xs font-medium text-gray-500"
                              >
                                Trạng thái
                              </TableCell>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {campaign.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                                      {item.productThumbnail ? (
                                        <img
                                          src={item.productThumbnail}
                                          alt={item.productName}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : null}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-800 dark:text-white/90">
                                        {item.productName}
                                      </p>
                                      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                                        Product #{item.productId}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  {formatCurrency(item.salePrice)}
                                  <br />
                                  <span className="text-theme-xs line-through">
                                    {formatCurrency(item.originalPrice)}
                                  </span>
                                </TableCell>
                                <TableCell className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  Còn {formatNumber(item.remainingStock)} /{" "}
                                  {formatNumber(item.stockLimit)}
                                  <br />
                                  Giữ {formatNumber(item.reservedCount)} · Bán{" "}
                                  {formatNumber(item.soldCount)}
                                </TableCell>
                                <TableCell className="px-4 py-3">
                                  <div className="flex flex-col items-start gap-2">
                                    <StatusBadge status={item.status} />
                                    {isPreloadable(campaign, item) ? (
                                      <button
                                        type="button"
                                        disabled={
                                          preloadingKey !== null ||
                                          item.remainingStock < 0
                                        }
                                        onClick={() =>
                                          void preloadItem(campaign, item)
                                        }
                                        className="rounded-lg border border-brand-200 px-3 py-1.5 text-theme-xs font-semibold text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/30 dark:text-brand-300 dark:hover:bg-brand-500/10"
                                      >
                                        {preloadingKey ===
                                        `${campaign.id}:${item.id}`
                                          ? "Đang preload..."
                                          : "Preload Redis"}
                                      </button>
                                    ) : null}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <EmptyState>Campaign chưa có sản phẩm.</EmptyState>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>Chưa có campaign flash sale nào.</EmptyState>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Tạo flash sale"
              description="Tạo campaign và gắn nhiều sản phẩm trong một lần"
            />
            <form className="space-y-4 p-5" onSubmit={saveCampaign}>
              <div>
                <Label>Tên campaign</Label>
                <Input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                />
              </div>
              <div>
                <Label>Trạng thái campaign</Label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateForm(
                      "status",
                      event.target.value as CampaignForm["status"],
                    )
                  }
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="active">Active</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Bắt đầu</Label>
                  <Input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) =>
                      updateForm("startsAt", event.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Kết thúc</Label>
                  <Input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(event) =>
                      updateForm("endsAt", event.target.value)
                    }
                  />
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.preloadStock}
                  onChange={(event) =>
                    updateForm("preloadStock", event.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-500"
                />
                <span>
                  Preload stock vào Redis ngay sau khi tạo để mobile có thể giữ
                  suất flash sale.
                </span>
              </label>

              <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                <div>
                  <Label>Tìm sản phẩm</Label>
                  <Input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Nhập tên sản phẩm"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedProductId}
                    onChange={(event) => setSelectedProductId(event.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  >
                    <option value="">
                      {productsLoading ? "Đang tải..." : "Chọn sản phẩm"}
                    </option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        #{product.id} · {product.name} ·{" "}
                        {formatCurrency(product.price)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedProduct}
                    onClick={addSelectedProduct}
                  >
                    Thêm
                  </Button>
                </div>
              </div>

              {items.length ? (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-800">
                          {item.productThumbnail ? (
                            <img
                              src={item.productThumbnail}
                              alt={item.productName}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 dark:text-white/90">
                            {item.productName}
                          </p>
                          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                            Giá gốc {formatCurrency(item.originalPrice)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="rounded-lg border border-error-200 px-3 py-2 text-sm font-medium text-error-600 hover:bg-error-50 dark:border-error-500/30 dark:text-error-400"
                        >
                          Xóa
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <Label>Giá sale</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.salePrice}
                            onChange={(event) =>
                              updateItem(
                                item.productId,
                                "salePrice",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label>Số suất</Label>
                          <Input
                            type="number"
                            min="0"
                            value={item.stockLimit}
                            onChange={(event) =>
                              updateItem(
                                item.productId,
                                "stockLimit",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label>Giới hạn/user</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.perUserLimit}
                            onChange={(event) =>
                              updateItem(
                                item.productId,
                                "perUserLimit",
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>Chọn sản phẩm để tạo flash sale.</EmptyState>
              )}

              <div className="flex gap-3">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Đang tạo..." : "Tạo flash sale"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetForm}
                >
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
