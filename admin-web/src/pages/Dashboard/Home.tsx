import { useEffect, useMemo, useState } from "react";
import { EmptyState, Panel, PanelHeader } from "../../components/admin/Panel";
import StatusBadge from "../../components/admin/StatusBadge";
import PageMeta from "../../components/common/PageMeta";
import Badge from "../../components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useAuth } from "../../hooks/useAuth";
import { commerceService } from "../../services/commerceService";
import { userService } from "../../services/userService";
import type { ManagedUser, Order, PaymentMethod, ShippingMethod } from "../../types/api";
import { formatCurrency, formatDateTime, formatNumber } from "../../utils/format";

type DashboardState = {
  orders: Order[];
  activeUsers: ManagedUser[];
  paymentMethods: PaymentMethod[];
  shippingMethods: ShippingMethod[];
  error: string | null;
  loading: boolean;
};

const initialState: DashboardState = {
  orders: [],
  activeUsers: [],
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
  const isAdmin = roleOf(user?.role) === "admin";

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      const [ordersResult, activeUsersResult, paymentsResult, shippingResult] = await Promise.allSettled([
        isAdmin ? commerceService.getAdminOrders() : commerceService.getSellerOrders(),
        isAdmin ? userService.listManagedUsers("", "active") : Promise.resolve([]),
        commerceService.getPaymentMethods(),
        commerceService.getShippingMethods(),
      ]);

      if (!active) {
        return;
      }

      const errors = [ordersResult, activeUsersResult, paymentsResult, shippingResult]
        .filter((result) => result.status === "rejected")
        .map((result) => (result as PromiseRejectedResult).reason?.message)
        .filter(Boolean);

      setState({
        orders: ordersResult.status === "fulfilled" ? ordersResult.value : [],
        activeUsers: activeUsersResult.status === "fulfilled" ? activeUsersResult.value : [],
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
  }, [isAdmin]);

  const metrics = useMemo(() => {
    const revenue = state.orders
      .filter((order) => !["cancelled", "returned", "refunded"].includes(order.status.toLowerCase()))
      .reduce((sum, order) => sum + order.total, 0);

    return {
      orders: state.orders.length,
      revenue,
      pendingOrders: state.orders.filter((order) => isOpenOrder(order.status)).length,
      activeUsers: state.activeUsers.length,
      activeSellers: state.activeUsers.filter((account) => roleOf(account.role) === "seller").length,
      activeCustomers: state.activeUsers.filter((account) => roleOf(account.role) === "customer").length,
    };
  }, [state.activeUsers, state.orders]);

  const recentOrders = [...state.orders]
    .sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime())
    .slice(0, 5);

  return (
    <>
      <PageMeta title="Ecommerce Admin Dashboard" description="Ecommerce admin dashboard" />

      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Xin chao, {user?.fullName}</p>
            <h1 className="text-title-sm font-bold text-gray-800 dark:text-white/90">Dashboard</h1>
          </div>
          <Badge color={isAdmin ? "primary" : "info"}>{user?.role}</Badge>
        </div>

        {state.error ? (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-orange-300">
            {state.error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Doanh thu" value={formatCurrency(metrics.revenue)} />
          <MetricCard label="Đơn hàng" value={formatNumber(metrics.orders)} />
          <MetricCard label="Đơn đang xử lý" value={formatNumber(metrics.pendingOrders)} />
          <MetricCard label="Tài khoản active" value={formatNumber(metrics.activeUsers)} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <MetricCard label="Seller active" value={formatNumber(metrics.activeSellers)} compact />
          <MetricCard label="Customer active" value={formatNumber(metrics.activeCustomers)} compact />
          <MetricCard
            label="Thanh toan bat"
            value={formatNumber(state.paymentMethods.filter((method) => method.enabled).length)}
            compact
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2">
            <PanelHeader
              title="Đơn gần đây"
              description={isAdmin ? "Nguon: /api/commerce/admin/orders" : "Nguon: /api/commerce/orders/seller"}
            />
            {state.loading ? (
              <EmptyState>Đang tải đơn hàng...</EmptyState>
            ) : recentOrders.length ? (
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                    <TableRow>
                      <HeaderCell>Mã đơn</HeaderCell>
                      <HeaderCell>Tổng tiền</HeaderCell>
                      <HeaderCell>Trạng thái</HeaderCell>
                      <HeaderCell>Ngày tạo</HeaderCell>
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
              <EmptyState>Chưa có đơn hàng phù hợp với trạng thái hiện tại.</EmptyState>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Tài khoản active" description="Nguon: users.status = active" />
            <div className="space-y-4 p-5">
              {isAdmin ? (
                <div className="space-y-2">
                  {state.activeUsers.slice(0, 6).map((account) => (
                    <div key={account.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-800 dark:text-white/90">{account.fullName}</p>
                        <p className="truncate text-theme-xs text-gray-500 dark:text-gray-400">{account.email}</p>
                      </div>
                      <StatusBadge status={account.role} />
                    </div>
                  ))}
                  {!state.activeUsers.length && !state.loading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Chua co tai khoan active.</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Seller không được xem danh sách tài khoản. Chỉ admin mới có thể xem danh sách tài khoản active.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
      {children}
    </TableCell>
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
