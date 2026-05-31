import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { userService, type UserRoleFilter, type UserStatusFilter } from "../../services/userService";
import type { ManagedUser } from "../../types/api";
import { compactId, formatDateTime, formatNumber } from "../../utils/format";

const roleOptions: Array<{ value: UserRoleFilter; label: string }> = [
  { value: "", label: "Tất cả vai trò" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "SELLER", label: "Seller" },
];

const statusOptions: Array<{ value: UserStatusFilter; label: string }> = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Bị vô hiệu hóa" },
  { value: "inactive", label: "Inactive" },
];

const roleOf = (role?: string | null) => role?.toLowerCase() ?? "";

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [allFetchedUsers, setAllFetchedUsers] = useState<ManagedUser[]>([]);
  const [role, setRole] = useState<UserRoleFilter>("");
  const [status, setStatus] = useState<UserStatusFilter>("");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = roleOf(user?.role) === "admin";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const loadUsers = useCallback(async (force = false) => {
    if (!isAdmin) {
      setUsers([]);
      setAllFetchedUsers([]);
      setLoading(false);
      return;
    }

    const cached = !force ? userService.getCachedManagedUsers(role, status, debouncedKeyword) : null;
    if (cached) {
      setUsers(cached);
      setAllFetchedUsers(userService.getCachedManagedUsers(role, status, "") || []);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await userService.listManagedUsers(role, status, debouncedKeyword, force); 
      setUsers(data);
      setAllFetchedUsers(userService.getCachedManagedUsers(role, status, "") || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được danh sách tài khoản");
    } finally {
      setLoading(false);
    }
  }, [debouncedKeyword, isAdmin, role, status]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const summary = useMemo(
    () => ({
      total: allFetchedUsers.length,
      sellers: allFetchedUsers.filter((item) => roleOf(item.role) === "seller").length,
      customers: allFetchedUsers.filter((item) => roleOf(item.role) === "customer").length,
      blocked: allFetchedUsers.filter((item) => item.status === "blocked").length,
    }),
    [allFetchedUsers],
  );

  const changeStatus = async (target: ManagedUser, nextStatus: "active" | "blocked") => {
    const action = nextStatus === "blocked" ? "vo hieu hoa" : "kích hoạt lại";
    if (!window.confirm(`Xác nhận ${action} tài khoản ${target.email}?`)) {
      return;
    }

    setSavingId(target.id);
    setError(null);
    try {
      const updated = await userService.updateStatus(target.id, nextStatus);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setAllFetchedUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không cập nhật được trạng thái tài khoản");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <PageMeta title="Users | Ecommerce Admin" description="User management" />
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-title-sm font-bold text-gray-800 dark:text-white/90">Người dùng</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Quản lý tài khoản customer và seller. Tài khoản bị vô hiệu hóa sẽ không thể đăng nhập.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void loadUsers(true)} disabled={loading || !isAdmin}>
            Tải lại
          </Button>
        </div>

        {!isAdmin ? (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300">
            Chức năng này chỉ dành cho ADMIN. Seller vẫn được đăng nhập admin-web để quản lý sản phẩm và đơn hàng.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-300">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <SummaryCard label="Số lượng tài khoản" value={formatNumber(summary.total)} />
          <SummaryCard label="Seller" value={formatNumber(summary.sellers)} />
          <SummaryCard label="Customer" value={formatNumber(summary.customers)} />
          <SummaryCard label="Bị vô hiệu hoá" value={formatNumber(summary.blocked)} />
        </div>

        <Panel>
          <PanelHeader
            title="Danh sách tài khoản"
            description="Nguon: GET /api/admin/users, cap nhat trang thai qua PATCH /api/admin/users/{id}/status"
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex min-w-56 flex-col gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
                  Tìm kiếm
                  <input
                    value={keyword}
                    disabled={!isAdmin || loading}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="Email, tên, số điện thoại"
                    className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />
                </label>
                <FilterSelect
                  label="Role"
                  value={role}
                  onChange={(value) => setRole(value as UserRoleFilter)}
                  options={roleOptions}
                  disabled={!isAdmin || loading}
                />
                <FilterSelect
                  label="Status"
                  value={status}
                  onChange={(value) => setStatus(value as UserStatusFilter)}
                  options={statusOptions}
                  disabled={!isAdmin || loading}
                />
              </div>
            }
          />
          {loading ? (
            <EmptyState>Đang tải tài khoản...</EmptyState>
          ) : users.length ? (
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                  <TableRow>
                    <HeaderCell>Tài khoản</HeaderCell>
                    <HeaderCell>Role</HeaderCell>
                    <HeaderCell>Trạng thái</HeaderCell>
                    <HeaderCell>Điện thoại</HeaderCell>
                    <HeaderCell>Ngày tạo</HeaderCell>
                    <HeaderCell>Thao tác</HeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {users.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="px-5 py-4">
                        <UserCell account={account} />
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <StatusBadge status={account.role} />
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <StatusBadge status={account.status} />
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {account.phoneNumber || "N/A"}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {formatDateTime(account.createdAt)}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        {account.status === "active" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-error-200 text-error-600 hover:bg-error-50 dark:border-error-500/30 dark:text-error-300"
                            onClick={() => void changeStatus(account, "blocked")}
                            disabled={savingId === account.id}
                          >
                            Vô hiệu hoá
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => void changeStatus(account, "active")}
                            disabled={savingId === account.id}
                          >
                            Kích hoạt lại
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState>Không có tài khoản phù hợp.</EmptyState>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Quy trinh tao tai khoan seller" description="Doc tu user-service AuthService" />
          <div className="space-y-3 p-5 text-sm text-gray-600 dark:text-gray-300">
            <p>
              Seller hiện đang từ đăng ký qua <span className="font-mono">POST /api/auth/register</span> bang payload co
              <span className="font-mono"> role: "seller"</span>. Backend gan role SELLER va status active sau khi qua OTP.
            </p>
            <p>
              Chua co nghiep vu admin tao seller rieng. Admin chi quan ly trang thai tai khoan customer/seller da ton tai.
            </p>
          </div>
        </Panel>
      </div>
    </>
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-w-40 flex-col gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return (
    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
      {children}
    </TableCell>
  );
}

function UserCell({ account }: { account: ManagedUser }) {
  return (
    <div>
      <p className="font-medium text-gray-800 dark:text-white/90">{account.fullName || "N/A"}</p>
      <p className="mt-1 break-all text-theme-xs text-gray-500 dark:text-gray-400">{account.email}</p>
      <p className="mt-1 text-theme-xs text-gray-400 dark:text-gray-500">{compactId(account.id)}</p>
    </div>
  );
}
