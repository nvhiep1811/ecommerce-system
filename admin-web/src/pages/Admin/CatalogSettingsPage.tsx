import { useEffect, useState } from "react";
import { Panel, PanelHeader, EmptyState } from "../../components/admin/Panel";
import StatusBadge from "../../components/admin/StatusBadge";
import PageMeta from "../../components/common/PageMeta";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { catalogService } from "../../services/catalogService";
import { commerceService } from "../../services/commerceService";
import type { Category, PaymentMethod, ShippingMethod } from "../../types/api";
import { formatCurrency } from "../../utils/format";

export default function CatalogSettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      const [categoryResult, paymentResult, shippingResult] = await Promise.allSettled([
        catalogService.getCategories(),
        commerceService.getPaymentMethods(),
        commerceService.getShippingMethods(),
      ]);

      if (!active) {
        return;
      }

      setCategories(categoryResult.status === "fulfilled" ? categoryResult.value : []);
      setPaymentMethods(paymentResult.status === "fulfilled" ? paymentResult.value : []);
      setShippingMethods(shippingResult.status === "fulfilled" ? shippingResult.value : []);

      const errors = [categoryResult, paymentResult, shippingResult]
        .filter((result) => result.status === "rejected")
        .map((result) => (result as PromiseRejectedResult).reason?.message)
        .filter(Boolean);

      setError(errors.length ? errors.join(" | ") : null);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PageMeta title="Catalog Settings | Ecommerce Admin" description="Catalog and system settings" />
      <div className="space-y-6">
        <div>
          <h1 className="text-title-sm font-bold text-gray-800 dark:text-white/90">Catalog & Cấu hình</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Danh mục, phương thức thanh toán và phương thức giao hàng đang có từ backend.
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-orange-300">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel>
            <PanelHeader title="Danh mục" description="Nguồn: /api/catalog/categories" />
            {loading ? (
              <EmptyState>Đang tải danh mục...</EmptyState>
            ) : categories.length ? (
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                    <TableRow>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        ID
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Tên
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Parent
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          #{category.id}
                        </TableCell>
                        <TableCell className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">
                          {category.name}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {category.parentId ?? "Root"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState>Chưa có danh mục.</EmptyState>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Phương thức thanh toán" description="Nguồn: /api/payment-methods" />
            {loading ? (
              <EmptyState>Đang tải thanh toán...</EmptyState>
            ) : paymentMethods.length ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {paymentMethods.map((method) => (
                  <div key={method.code} className="flex items-start justify-between gap-4 px-5 py-4">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white/90">{method.name}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{method.description}</p>
                      <p className="mt-1 text-theme-xs text-gray-400">{method.code} · {method.type}</p>
                    </div>
                    <StatusBadge status={method.enabled} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>Chưa có phương thức thanh toán.</EmptyState>
            )}
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="Phương thức giao hàng" description="Nguồn: /api/shipping-methods" />
          {loading ? (
            <EmptyState>Đang tải giao hàng...</EmptyState>
          ) : shippingMethods.length ? (
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                      Tên
                    </TableCell>
                    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                      Thời gian
                    </TableCell>
                    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                      Phí
                    </TableCell>
                    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                      Trạng thái
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {shippingMethods.map((method) => (
                    <TableRow key={method.id}>
                      <TableCell className="px-5 py-4">
                        <p className="font-medium text-gray-800 dark:text-white/90">{method.name}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{method.description}</p>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {method.estimatedMinDays}-{method.estimatedMaxDays} ngày
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {formatCurrency(method.fee)}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <StatusBadge status={method.active} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState>Chưa có phương thức giao hàng.</EmptyState>
          )}
        </Panel>
      </div>
    </>
  );
}
