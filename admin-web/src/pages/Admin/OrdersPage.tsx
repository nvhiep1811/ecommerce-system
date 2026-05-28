import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { EmptyState, Panel, PanelHeader } from "../../components/admin/Panel";
import StatusBadge from "../../components/admin/StatusBadge";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useAuth } from "../../hooks/useAuth";
import { commerceService } from "../../services/commerceService";
import type { Order } from "../../types/api";
import { compactId, formatCurrency, formatDateTime, formatNumber } from "../../utils/format";

const statusOptions = [
  { value: "", label: "Tat ca" },
  { value: "pending", label: "Pending" },
  { value: "pending_payment", label: "Pending payment" },
  { value: "paid", label: "Paid" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const roleOf = (role?: string | null) => role?.toLowerCase() ?? "";
const isOpenOrder = (status: string) =>
  ["pending", "pending_payment", "paid", "confirmed", "processing", "shipped"].includes(status.toLowerCase());

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState("");
  const [lookupOrderId, setLookupOrderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = roleOf(user?.role) === "admin";
  const isSeller = roleOf(user?.role) === "seller";

  const loadOrders = useCallback(async () => {
    if (!isAdmin && !isSeller) {
      setOrders([]);
      setSelectedOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = isAdmin
        ? await commerceService.getAdminOrders(status || undefined)
        : await commerceService.getSellerOrders(status || undefined);
      setOrders(data);
      setSelectedOrder((current) => {
        if (!current) {
          return data[0] ?? null;
        }
        return data.find((order) => order.id === current.id) ?? data[0] ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Khong tai duoc don hang");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isSeller, status]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const totals = useMemo(
    () => ({
      count: orders.length,
      revenue: orders
        .filter((order) => !["cancelled", "returned", "refunded"].includes(order.status.toLowerCase()))
        .reduce((sum, order) => sum + order.total, 0),
      open: orders.filter((order) => isOpenOrder(order.status)).length,
    }),
    [orders],
  );

  const refreshSelected = async (order: Order) => {
    const fresh = await commerceService.getOrder(order.id);
    setSelectedOrder(fresh);
    setOrders((current) => current.map((item) => (item.id === fresh.id ? fresh : item)));
  };

  const lookupOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = Number(lookupOrderId);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Nhap ID don hang hop le de tra cuu.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const found = await commerceService.getOrder(id);
      setSelectedOrder(found);
      setOrders((current) => {
        const exists = current.some((order) => order.id === found.id);
        return exists ? current.map((order) => (order.id === found.id ? found : order)) : [found, ...current];
      });
      setMessage("Da tai chi tiet don hang theo ID.");
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Khong tim thay don hang");
    } finally {
      setSaving(false);
    }
  };

  const advanceOrder = async () => {
    if (!selectedOrder || !isSeller) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await commerceService.advanceOrder(selectedOrder.id);
      setSelectedOrder(updated);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Khong cap nhat duoc don hang");
    } finally {
      setSaving(false);
    }
  };

  const cancelOrder = async () => {
    if (!selectedOrder || !isSeller) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await commerceService.cancelOrder(selectedOrder.id);
      setSelectedOrder(updated);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Khong huy duoc don hang");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta title="Orders | Ecommerce Admin" description="Order management" />
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-title-sm font-bold text-gray-800 dark:text-white/90">Don hang</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {isAdmin
                ? `${formatNumber(totals.count)} don tren he thong, ${formatNumber(totals.open)} don dang xu ly`
                : `${formatNumber(totals.count)} don seller, ${formatNumber(totals.open)} don dang xu ly`}
            </p>
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={!isAdmin && !isSeller}
            className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:disabled:bg-gray-800 sm:w-56"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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

        <Panel>
          <PanelHeader
            title="Tra cuu don hang"
            description="Admin doc danh sach toan he thong va co the tra cuu chi tiet theo ID."
          />
          <form className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end" onSubmit={lookupOrder}>
            <label className="flex-1">
              <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">ID don hang</span>
              <input
                type="number"
                min="1"
                value={lookupOrderId}
                onChange={(event) => setLookupOrderId(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                placeholder="Vi du: 1"
              />
            </label>
            <Button type="submit" size="sm" disabled={saving}>
              Tim don
            </Button>
          </form>
        </Panel>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Tong don" value={formatNumber(totals.count)} />
          <SummaryCard label="Doanh thu" value={formatCurrency(totals.revenue)} />
          <SummaryCard label="Dang xu ly" value={formatNumber(totals.open)} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2">
            <PanelHeader
              title="Danh sach don hang"
              description={isAdmin ? "Nguon: /api/commerce/admin/orders" : "Nguon: /api/commerce/orders/seller"}
            />
            {loading ? (
              <EmptyState>Dang tai don hang...</EmptyState>
            ) : orders.length ? (
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                    <TableRow>
                      <HeaderCell>Ma don</HeaderCell>
                      <HeaderCell>Khach hang</HeaderCell>
                      <HeaderCell>Seller</HeaderCell>
                      <HeaderCell>Tong tien</HeaderCell>
                      <HeaderCell>Thanh toan</HeaderCell>
                      <HeaderCell>Trang thai</HeaderCell>
                      <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium text-gray-500">
                        Chi tiet
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {orders.map((order) => (
                      <TableRow
                        key={order.id}
                        className={selectedOrder?.id === order.id ? "bg-brand-50/60 dark:bg-brand-500/10" : ""}
                      >
                        <TableCell className="px-5 py-4">
                          <p className="font-medium text-gray-800 dark:text-white/90">{order.orderNo}</p>
                          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                            {formatDateTime(order.createdAt)}
                          </p>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {order.address?.fullName || compactId(order.userId)}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          <SellerCell order={order} />
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatCurrency(order.total)}
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          <StatusBadge status={order.paymentStatus} />
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="px-5 py-4 text-end">
                          <button
                            type="button"
                            onClick={() => void refreshSelected(order)}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                          >
                            Xem
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState>Khong co don hang cho bo loc nay.</EmptyState>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Chi tiet don" description={selectedOrder?.orderNo ?? "Chua chon don"} />
            {selectedOrder ? (
              <div className="space-y-5 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <InfoTile label="Tong tien" value={formatCurrency(selectedOrder.total)} />
                  <InfoTile label="Phi ship" value={formatCurrency(selectedOrder.shippingFee)} />
                  <InfoTile label="Giam gia" value={formatCurrency(selectedOrder.discount)} />
                  <InfoTile label="PTTT" value={selectedOrder.paymentMethod} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">Dia chi</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedOrder.address?.fullName} - {selectedOrder.address?.phone}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedOrder.address?.addressLine}, {selectedOrder.address?.city}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">Seller</p>
                  {selectedOrder.sellers.length ? (
                    selectedOrder.sellers.map((seller) => (
                      <div
                        key={seller.sellerId || seller.sellerName}
                        className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.03]"
                      >
                        <p className="text-sm font-medium text-gray-800 dark:text-white/90">{seller.sellerName}</p>
                        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                          {compactId(seller.sellerId)} - {seller.itemCount} san pham
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Chua doc duoc seller cua don nay.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">San pham</p>
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 p-3 dark:bg-white/[0.03]"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                          {item.products?.name ?? `Product #${item.productId}`}
                        </p>
                        <p className="text-theme-xs text-gray-500 dark:text-gray-400">SL: {item.quantity}</p>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-300">{formatCurrency(item.price)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button size="sm" onClick={advanceOrder} disabled={saving || !isSeller}>
                    Chuyen buoc
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelOrder} disabled={saving || !isSeller}>
                    Huy don
                  </Button>
                </div>
                {!isSeller ? (
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    Admin theo doi don hang toan he thong; thao tac chuyen buoc/huy don van thuoc role SELLER.
                  </p>
                ) : null}
              </div>
            ) : (
              <EmptyState>Chon mot don de xem chi tiet.</EmptyState>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return (
    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
      {children}
    </TableCell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-theme-xl font-bold text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

function SellerCell({ order }: { order: Order }) {
  if (!order.sellers.length) {
    return <span>N/A</span>;
  }
  const [first, ...rest] = order.sellers;
  return (
    <div>
      <p className="font-medium text-gray-800 dark:text-white/90">{first.sellerName}</p>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        {compactId(first.sellerId)}
        {rest.length ? ` +${rest.length} seller` : ""}
      </p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.03]">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}
