import { useCallback, useEffect, useMemo, useState } from "react";
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
import { catalogService } from "../../services/catalogService";
import { commerceService } from "../../services/commerceService";
import type { Order, Product } from "../../types/api";
import { compactId, formatCurrency, formatDateTime, formatNumber } from "../../utils/format";

type SellerDirectoryRow = {
  id: string;
  name: string;
  productCount: number;
  sampleProduct: string;
  lastProductAt: string | null;
};

type CustomerDirectoryRow = {
  id: string;
  name: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

const accountCapabilityRows = [
  {
    label: "Danh sách tài khoản seller/customer",
    current: "Chỉ suy ra được một phần từ products/orders",
    needed: "GET /api/admin/users?role=SELLER|CUSTOMER&status=...",
  },
  {
    label: "Vô hiệu hóa tài khoản",
    current: "Backend có cột users.status nhưng chưa có endpoint cập nhật",
    needed: "PATCH /api/admin/users/{id}/status",
  },
  {
    label: "Danh sách tài khoản bị vô hiệu hóa",
    current: "Không có API lọc users.status = disabled",
    needed: "GET /api/admin/users?status=disabled",
  },
  {
    label: "Mở lại tài khoản",
    current: "Login đã chặn status khác active, nhưng admin chưa đổi lại được",
    needed: "PATCH /api/admin/users/{id}/status { status: 'active' }",
  },
];

const roleOf = (role?: string | null) => role?.toLowerCase() ?? "";

export default function UsersPage() {
  const { user } = useAuth();
  const [sellerRows, setSellerRows] = useState<SellerDirectoryRow[]>([]);
  const [customerRows, setCustomerRows] = useState<CustomerDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSeller = roleOf(user?.role) === "seller";

  const loadReadableUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [productPage, sellerOrders] = await Promise.all([
        catalogService.getProductsPage({ page: 0, size: 50 }),
        isSeller ? commerceService.getSellerOrders() : Promise.resolve<Order[]>([]),
      ]);

      setSellerRows(buildSellerRows(productPage.items));
      setCustomerRows(buildCustomerRows(sellerOrders));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được dữ liệu người dùng");
    } finally {
      setLoading(false);
    }
  }, [isSeller]);

  useEffect(() => {
    void loadReadableUsers();
  }, [loadReadableUsers]);

  const summary = useMemo(
    () => ({
      sellers: sellerRows.length,
      customers: customerRows.length,
      disabled: 0,
    }),
    [customerRows.length, sellerRows.length],
  );

  return (
    <>
      <PageMeta title="Users | Ecommerce Admin" description="User management" />
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-title-sm font-bold text-gray-800 dark:text-white/90">Người dùng</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Đọc theo API backend hiện có, không gọi endpoint admin chưa tồn tại.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void loadReadableUsers()} disabled={loading}>
            Tải lại
          </Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-300">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Seller đọc được" value={formatNumber(summary.sellers)} />
          <SummaryCard label="Customer đọc được" value={formatNumber(summary.customers)} />
          <SummaryCard label="Bị vô hiệu hóa" value={formatNumber(summary.disabled)} note="Chưa có API list" />
        </div>

        <Panel>
          <PanelHeader title="Tài khoản đang đăng nhập" description="/api/users/me" />
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            <Info label="ID" value={compactId(user?.id)} />
            <Info label="Email" value={user?.email ?? "N/A"} />
            <Info label="Họ tên" value={user?.fullName ?? "N/A"} />
            <Info label="Số điện thoại" value={user?.phoneNumber ?? "N/A"} />
            <Info label="Ngày tạo" value={formatDateTime(user?.createdAt)} />
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-white/[0.03]">
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">Role</p>
              <div className="mt-2">
                <StatusBadge status={user?.role} />
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel>
            <PanelHeader title="Seller có sản phẩm" description="Suy ra từ /api/catalog/products/page" />
            {loading ? (
              <EmptyState>Đang tải seller...</EmptyState>
            ) : sellerRows.length ? (
              <DirectoryTable
                columns={["Seller", "Sản phẩm", "Sản phẩm mẫu", "Cập nhật", "Thao tác"]}
                rows={sellerRows.map((seller) => [
                  <UserCell key="seller" title={seller.name} subtitle={compactId(seller.id)} />,
                  formatNumber(seller.productCount),
                  seller.sampleProduct,
                  formatDateTime(seller.lastProductAt),
                  <UnavailableAction key="action" />,
                ])}
              />
            ) : (
              <EmptyState>Chưa đọc được seller nào từ danh sách sản phẩm.</EmptyState>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Customer có đơn"
              description={isSeller ? "Suy ra từ /api/commerce/orders/seller" : "Admin chưa có API list all orders"}
            />
            {loading ? (
              <EmptyState>Đang tải customer...</EmptyState>
            ) : customerRows.length ? (
              <DirectoryTable
                columns={["Customer", "Đơn", "Tổng chi", "Đơn gần nhất", "Thao tác"]}
                rows={customerRows.map((customer) => [
                  <UserCell
                    key="customer"
                    title={customer.name || "Khách hàng"}
                    subtitle={`${compactId(customer.id)}${customer.phone ? ` - ${customer.phone}` : ""}`}
                  />,
                  formatNumber(customer.orderCount),
                  formatCurrency(customer.totalSpent),
                  formatDateTime(customer.lastOrderAt),
                  <UnavailableAction key="action" />,
                ])}
              />
            ) : (
              <EmptyState>
                {isSeller
                  ? "Chưa có customer trong đơn hàng seller đọc được."
                  : "Backend hiện chưa có endpoint để admin liệt kê customer hoặc toàn bộ đơn hàng."}
              </EmptyState>
            )}
          </Panel>
        </div>

        <Panel>
          <PanelHeader
            title="Nghiệp vụ vô hiệu hóa tài khoản"
            description="Không bật thao tác ghi vì backend hiện không có API admin cho users.status"
          />
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                <TableRow>
                  <HeaderCell>Nghiệp vụ</HeaderCell>
                  <HeaderCell>Backend hiện tại</HeaderCell>
                  <HeaderCell>API cần có</HeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {accountCapabilityRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="px-5 py-4 text-sm font-medium text-gray-800 dark:text-white/90">
                      {row.label}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {row.current}
                    </TableCell>
                    <TableCell className="px-5 py-4 font-mono text-theme-xs text-gray-500 dark:text-gray-400">
                      {row.needed}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </div>
    </>
  );
}

function buildSellerRows(products: Product[]): SellerDirectoryRow[] {
  const sellers = new Map<string, SellerDirectoryRow>();

  products.forEach((product) => {
    if (!product.sellerId) {
      return;
    }

    const current = sellers.get(product.sellerId);
    if (!current) {
      sellers.set(product.sellerId, {
        id: product.sellerId,
        name: product.sellerName || "Seller",
        productCount: 1,
        sampleProduct: product.name,
        lastProductAt: product.createdAt,
      });
      return;
    }

    current.productCount += 1;
    if (isAfter(product.createdAt, current.lastProductAt)) {
      current.sampleProduct = product.name;
      current.lastProductAt = product.createdAt;
    }
  });

  return Array.from(sellers.values()).sort((left, right) => right.productCount - left.productCount);
}

function buildCustomerRows(orders: Order[]): CustomerDirectoryRow[] {
  const customers = new Map<string, CustomerDirectoryRow>();

  orders.forEach((order) => {
    if (!order.userId) {
      return;
    }

    const current = customers.get(order.userId);
    if (!current) {
      customers.set(order.userId, {
        id: order.userId,
        name: order.address?.fullName ?? "",
        phone: order.address?.phone ?? "",
        orderCount: 1,
        totalSpent: order.total,
        lastOrderAt: order.createdAt,
      });
      return;
    }

    current.orderCount += 1;
    current.totalSpent += order.total;
    if (isAfter(order.createdAt, current.lastOrderAt)) {
      current.name = order.address?.fullName ?? current.name;
      current.phone = order.address?.phone ?? current.phone;
      current.lastOrderAt = order.createdAt;
    }
  });

  return Array.from(customers.values()).sort((left, right) => right.totalSpent - left.totalSpent);
}

function isAfter(left?: string | null, right?: string | null) {
  if (!left) {
    return false;
  }
  if (!right) {
    return true;
  }
  return new Date(left).getTime() > new Date(right).getTime();
}

function SummaryCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-theme-xl font-bold text-gray-800 dark:text-white/90">{value}</p>
      {note ? <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">{note}</p> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4 dark:bg-white/[0.03]">
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

function DirectoryTable({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <Table>
        <TableHeader className="border-b border-gray-100 dark:border-gray-800">
          <TableRow>
            {columns.map((column) => (
              <HeaderCell key={column}>{column}</HeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row, index) => (
            <TableRow key={index}>
              {row.map((cell, cellIndex) => (
                <TableCell key={cellIndex} className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
      {children}
    </TableCell>
  );
}

function UserCell({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="font-medium text-gray-800 dark:text-white/90">{title}</p>
      <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );
}

function UnavailableAction() {
  return (
    <button
      type="button"
      disabled
      className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-400 dark:border-gray-800 dark:text-gray-600"
      title="Backend chưa có API vô hiệu hóa/mở tài khoản"
    >
      Chưa hỗ trợ
    </button>
  );
}
