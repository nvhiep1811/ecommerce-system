import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { Panel, PanelHeader, EmptyState } from "../../components/admin/Panel";
import StatusBadge from "../../components/admin/StatusBadge";
import Badge from "../../components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useAuth } from "../../hooks/useAuth";
import { catalogService } from "../../services/catalogService";
import { commerceService } from "../../services/commerceService";
import type { Coupon, Order, PaymentMethod, Product, ShippingMethod } from "../../types/api";
import { formatCurrency, formatDateTime, formatNumber } from "../../utils/format";

type DashboardState = {
  products: Product[];
  orders: Order[];
  coupons: Coupon[];
  paymentMethods: PaymentMethod[];
  shippingMethods: ShippingMethod[];
  error: string | null;
  loading: boolean;
};

const initialState: DashboardState = {
  products: [],
  orders: [],
  coupons: [],
  paymentMethods: [],
  shippingMethods: [],
  error: null,
  loading: true,
};

const isOpenOrder = (status: string) =>
  ["pending", "pending_payment", "paid", "confirmed", "processing", "shipped"].includes(
    status.toLowerCase(),
  );

const roleOf = (role?: string | null) => role?.toLowerCase() ?? "";

export default function Home() {
  const { user } = useAuth();
  const [state, setState] = useState<DashboardState>(initialState);
  const isSeller = roleOf(user?.role) === "seller";

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      const [productsResult, ordersResult, couponsResult, paymentsResult, shippingResult] =
        await Promise.allSettled([
          catalogService.getProductsPage({
            page: 0,
            size: 50,
            sellerId: isSeller ? user?.id : null,
          }),
          commerceService.getSellerOrders(),
          catalogService.getCoupons(),
          commerceService.getPaymentMethods(),
          commerceService.getShippingMethods(),
        ]);

      if (!active) {
        return;
      }

      const errors = [
        productsResult,
        ordersResult,
        couponsResult,
        paymentsResult,
        shippingResult,
      ]
        .filter((result) => result.status === "rejected")
        .map((result) => (result as PromiseRejectedResult).reason?.message)
        .filter(Boolean);

      setState({
        products: productsResult.status === "fulfilled" ? productsResult.value.items : [],
        orders: ordersResult.status === "fulfilled" ? ordersResult.value : [],
        coupons: couponsResult.status === "fulfilled" ? couponsResult.value : [],
        paymentMethods: paymentsResult.status === "fulfilled" ? paymentsResult.value : [],
        shippingMethods: shippingResult.status === "fulfilled" ? shippingResult.value : [],
        error: errors.length ? errors.join(" | ") : null,
        loading: false,
      });
    }

    void load();

    return () => {
      active = false;
    };
  }, [isSeller, user?.id]);

  const metrics = useMemo(() => {
    const revenue = state.orders
      .filter((order) => !["cancelled", "returned", "refunded"].includes(order.status.toLowerCase()))
      .reduce((sum, order) => sum + order.total, 0);
    const lowStock = state.products.filter((product) => product.stock > 0 && product.stock <= 5).length;

    return {
      products: state.products.length,
      orders: state.orders.length,
      revenue,
      pendingOrders: state.orders.filter((order) => isOpenOrder(order.status)).length,
      lowStock,
      coupons: state.coupons.length,
    };
  }, [state.coupons.length, state.orders, state.products]);

  const recentOrders = [...state.orders]
    .sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime())
    .slice(0, 5);

  return (
    <>
      <PageMeta title="Ecommerce Admin Dashboard" description="Ecommerce admin dashboard" />

      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Xin chào, {user?.fullName}</p>
            <h1 className="text-title-sm font-bold text-gray-800 dark:text-white/90">Dashboard</h1>
          </div>
          <Badge color={roleOf(user?.role) === "admin" ? "primary" : "info"}>{user?.role}</Badge>
        </div>

        {state.error ? (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-orange-300">
            {state.error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Doanh thu" value={formatCurrency(metrics.revenue)} />
          <MetricCard label="Đơn hàng" value={formatNumber(metrics.orders)} />
          <MetricCard label="Sản phẩm" value={formatNumber(metrics.products)} />
          <MetricCard label="Đơn đang xử lý" value={formatNumber(metrics.pendingOrders)} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <MetricCard label="Sắp hết hàng" value={formatNumber(metrics.lowStock)} compact />
          <MetricCard label="Coupon đang bật" value={formatNumber(metrics.coupons)} compact />
          <MetricCard
            label="Thanh toán bật"
            value={formatNumber(state.paymentMethods.filter((method) => method.enabled).length)}
            compact
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2">
            <PanelHeader title="Đơn gần đây" description="Dữ liệu lấy từ /api/commerce/orders/seller" />
            {state.loading ? (
              <EmptyState>Đang tải đơn hàng...</EmptyState>
            ) : recentOrders.length ? (
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                    <TableRow>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Mã đơn
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Tổng tiền
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Trạng thái
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Ngày tạo
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {recentOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="px-5 py-4 text-sm font-medium text-gray-800 dark:text-white/90">
                          {order.orderNo}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatCurrency(order.total)}
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatDateTime(order.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState>Chưa có đơn hàng phù hợp với tài khoản hiện tại.</EmptyState>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Cấu hình bán hàng" description="Payment và shipping methods" />
            <div className="space-y-4 p-5">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-800 dark:text-white/90">Thanh toán</p>
                <div className="space-y-2">
                  {state.paymentMethods.slice(0, 5).map((method) => (
                    <div key={method.code} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{method.name}</span>
                      <StatusBadge status={method.enabled} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-800 dark:text-white/90">Giao hàng</p>
                <div className="space-y-2">
                  {state.shippingMethods.slice(0, 4).map((method) => (
                    <div key={method.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{method.name}</span>
                      <span className="text-gray-500 dark:text-gray-400">{formatCurrency(method.fee)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`mt-2 font-bold text-gray-800 dark:text-white/90 ${
          compact ? "text-theme-xl" : "text-title-sm"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
