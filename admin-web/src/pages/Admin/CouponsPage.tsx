import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { catalogService } from "../../services/catalogService";
import type { Coupon, CouponPayload } from "../../types/api";
import { formatCurrency, formatDateTime, formatNumber } from "../../utils/format";

type CouponForm = {
  id?: number;
  code: string;
  description: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  minOrderValue: string;
  maxDiscount: string;
  startAt: string;
  endAt: string;
  usageLimit: string;
  active: boolean;
};

const emptyForm: CouponForm = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: "",
  minOrderValue: "0",
  maxDiscount: "",
  startAt: "",
  endAt: "",
  usageLimit: "",
  active: true,
};

const toLocalInput = (value: string | null) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toIsoOrNull = (value: string) => (value ? new Date(value).toISOString() : null);

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadCoupons() {
    setLoading(true);
    setError(null);
    try {
      setCoupons(await catalogService.getCoupons());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được coupon");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCoupons();
  }, []);

  const activeCoupons = useMemo(() => coupons.filter((coupon) => coupon.active).length, [coupons]);

  const updateForm = (key: keyof CouponForm, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const editCoupon = (coupon: Coupon) => {
    setMessage(null);
    setError(null);
    setForm({
      id: coupon.id,
      code: coupon.code,
      description: coupon.description ?? "",
      discountType: coupon.discountType === "fixed" ? "fixed" : "percent",
      discountValue: String(coupon.discountValue),
      minOrderValue: String(coupon.minOrderValue),
      maxDiscount: coupon.maxDiscount == null ? "" : String(coupon.maxDiscount),
      startAt: toLocalInput(coupon.startAt),
      endAt: toLocalInput(coupon.endAt),
      usageLimit: coupon.usageLimit == null ? "" : String(coupon.usageLimit),
      active: coupon.active,
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setError(null);
    setMessage(null);
  };

  const toPayload = (): CouponPayload => ({
    code: form.code.trim().toUpperCase(),
    description: form.description.trim() || null,
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    minOrderValue: Number(form.minOrderValue || 0),
    maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
    startAt: toIsoOrNull(form.startAt),
    endAt: toIsoOrNull(form.endAt),
    usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
    active: form.active,
  });

  const saveCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = toPayload();
      if (form.id) {
        const updatePayload = { ...payload };
        delete updatePayload.code;
        await catalogService.updateCoupon(form.id, updatePayload);
        setMessage("Đã cập nhật coupon.");
      } else {
        if (!payload.code) {
          throw new Error("Mã coupon là bắt buộc");
        }
        await catalogService.createCoupon({ ...payload, code: payload.code });
        setMessage("Đã tạo coupon mới.");
      }
      setForm(emptyForm);
      await loadCoupons();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không lưu được coupon");
    } finally {
      setSaving(false);
    }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    setSaving(true);
    setError(null);
    try {
      await catalogService.deleteCoupon(coupon.id);
      setMessage(`Đã xóa ${coupon.code}.`);
      await loadCoupons();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không xóa được coupon");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta title="Coupons | Ecommerce Admin" description="Coupon management" />
      <div className="space-y-6">
        <div>
          <h1 className="text-title-sm font-bold text-gray-800 dark:text-white/90">Coupon</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {formatNumber(activeCoupons)} coupon đang bật trên tổng {formatNumber(coupons.length)}
          </p>
        </div>

        <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-orange-300">
          Backend hiện yêu cầu role SELLER cho thao tác tạo, sửa và xóa coupon.
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
            <PanelHeader title="Danh sách coupon" description="Nguồn: /api/catalog/coupons" />
            {loading ? (
              <EmptyState>Đang tải coupon...</EmptyState>
            ) : coupons.length ? (
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                    <TableRow>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Mã
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Giảm giá
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Điều kiện
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Đã dùng
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">
                        Trạng thái
                      </TableCell>
                      <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium text-gray-500">
                        Thao tác
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {coupons.map((coupon) => (
                      <TableRow key={coupon.id}>
                        <TableCell className="px-5 py-4">
                          <p className="font-medium text-gray-800 dark:text-white/90">{coupon.code}</p>
                          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                            {coupon.description ?? "Không có mô tả"}
                          </p>
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {coupon.discountType === "percent"
                            ? `${coupon.discountValue}%`
                            : formatCurrency(coupon.discountValue)}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          Tối thiểu {formatCurrency(coupon.minOrderValue)}
                          <br />
                          Hết hạn {formatDateTime(coupon.endAt)}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {coupon.usedCount}/{coupon.usageLimit ?? "∞"}
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          <StatusBadge status={coupon.active} />
                        </TableCell>
                        <TableCell className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => editCoupon(coupon)}
                              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteCoupon(coupon)}
                              disabled={saving}
                              className="rounded-lg border border-error-200 px-3 py-2 text-sm font-medium text-error-600 hover:bg-error-50 disabled:opacity-50 dark:border-error-500/30 dark:text-error-400 dark:hover:bg-error-500/10"
                            >
                              Xóa
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState>Không có coupon nào.</EmptyState>
            )}
          </Panel>

          <Panel>
            <PanelHeader title={form.id ? "Sửa coupon" : "Tạo coupon"} description="Theo CreateCouponRequest" />
            <form className="space-y-4 p-5" onSubmit={saveCoupon}>
              <div>
                <Label>Mã coupon</Label>
                <Input
                  value={form.code}
                  disabled={Boolean(form.id)}
                  onChange={(event) => updateForm("code", event.target.value)}
                />
              </div>
              <div>
                <Label>Mô tả</Label>
                <TextArea value={form.description} onChange={(value) => updateForm("description", value)} />
              </div>
              <div>
                <Label>Loại giảm giá</Label>
                <select
                  value={form.discountType}
                  onChange={(event) => updateForm("discountType", event.target.value as "percent" | "fixed")}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Giá trị</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.discountValue}
                    onChange={(event) => updateForm("discountValue", event.target.value)}
                  />
                </div>
                <div>
                  <Label>Đơn tối thiểu</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.minOrderValue}
                    onChange={(event) => updateForm("minOrderValue", event.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Giảm tối đa</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.maxDiscount}
                    onChange={(event) => updateForm("maxDiscount", event.target.value)}
                  />
                </div>
                <div>
                  <Label>Giới hạn lượt dùng</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.usageLimit}
                    onChange={(event) => updateForm("usageLimit", event.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Bắt đầu</Label>
                  <Input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(event) => updateForm("startAt", event.target.value)}
                  />
                </div>
                <div>
                  <Label>Kết thúc</Label>
                  <Input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(event) => updateForm("endAt", event.target.value)}
                  />
                </div>
              </div>
              <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => updateForm("active", event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-500"
                />
                Đang hoạt động
              </label>
              <div className="flex gap-3">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Đang lưu..." : form.id ? "Cập nhật" : "Tạo mới"}
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
