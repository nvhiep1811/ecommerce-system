import { useEffect, useState, useCallback, useMemo } from "react";
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
import Button from "../../components/ui/button/Button";
import { catalogService } from "../../services/catalogService";
import { commerceService } from "../../services/commerceService";
import type { 
  Category, PaymentMethod, ShippingMethod, 
  CategoryPayload, PaymentMethodPayload, ShippingMethodPayload 
} from "../../types/api";
import { formatCurrency } from "../../utils/format";

import { ConfirmDeleteModal } from "./components/CatalogSettings/ConfirmDeleteModal";
import { CategoryFormModal } from "./components/CatalogSettings/CategoryFormModal";
import { PaymentMethodFormModal } from "./components/CatalogSettings/PaymentMethodFormModal";
import { ShippingMethodFormModal } from "./components/CatalogSettings/ShippingMethodFormModal";

export default function CatalogSettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentMethod | null>(null);

  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  const [editingShipping, setEditingShipping] = useState<ShippingMethod | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'payment' | 'shipping', id: string | number, name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [categoryResult, paymentResult, shippingResult] = await Promise.allSettled([
      catalogService.getCategories(null, true), // Lấy ALL danh mục
      commerceService.getPaymentMethods(),
      commerceService.getShippingMethods(),
    ]);

    setCategories(categoryResult.status === "fulfilled" ? categoryResult.value : []);
    setPaymentMethods(paymentResult.status === "fulfilled" ? paymentResult.value : []);
    setShippingMethods(shippingResult.status === "fulfilled" ? shippingResult.value : []);

    const errors = [categoryResult, paymentResult, shippingResult]
      .filter((result) => result.status === "rejected")
      .map((result) => (result as PromiseRejectedResult).reason?.message)
      .filter(Boolean);

    setError(errors.length ? errors.join(" | ") : null);
    setLoading(false);
  }, []);

  const sortedCategories = useMemo(() => {
    const roots = categories.filter((c) => !c.parentId);
    const children = categories.filter((c) => c.parentId);

    const result: (Category & { isChild?: boolean; parentName?: string })[] = [];

    roots.forEach((root) => {
      result.push(root); // Đẩy danh mục cha vào trước
      // Tìm tất cả các con của danh mục cha này và đẩy ngay theo sau
      const rootChildren = children.filter((c) => c.parentId === root.id);
      rootChildren.forEach((child) => {
        result.push({ ...child, isChild: true, parentName: root.name });
      });
    });

    return result;
  }, [categories]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Submit Handlers
  const handleCategorySubmit = async (payload: CategoryPayload) => {
    if (editingCategory) {
      await catalogService.updateCategory(editingCategory.id, payload);
    } else {
      await catalogService.createCategory(payload);
    }
    await loadData();
  };

  const handlePaymentSubmit = async (payload: PaymentMethodPayload) => {
    if (editingPayment) {
      await commerceService.updatePaymentMethod(editingPayment.code, payload);
    } else {
      await commerceService.createPaymentMethod(payload);
    }
    await loadData();
  };

  const handleShippingSubmit = async (payload: ShippingMethodPayload) => {
    if (editingShipping) {
      await commerceService.updateShippingMethod(editingShipping.id, payload);
    } else {
      await commerceService.createShippingMethod(payload);
    }
    await loadData();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'category') {
        await catalogService.deleteCategory(deleteTarget.id as number);
      } else if (deleteTarget.type === 'payment') {
        await commerceService.deletePaymentMethod(deleteTarget.id as string);
      } else if (deleteTarget.type === 'shipping') {
        await commerceService.deleteShippingMethod(deleteTarget.id as number);
      }
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await loadData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err : any) {
      setError(err.message || "Xoá thất bại");
      setDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const ActionButtons = ({ onEdit, onDelete }: { onEdit: () => void, onDelete: () => void }) => (
    <div className="flex items-center gap-2">
      <button onClick={onEdit} className="text-brand-500 hover:text-brand-600 dark:text-brand-400">Sửa</button>
      <span className="text-gray-300 dark:text-gray-700">|</span>
      <button onClick={onDelete} className="text-error-500 hover:text-error-600 dark:text-error-400">Xoá</button>
    </div>
  );

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
            <PanelHeader 
              title="Danh mục" 
              description="Nguồn: /api/catalog/categories" 
              action={
                <Button size="sm" onClick={() => { setEditingCategory(null); setCategoryModalOpen(true); }}>
                  + Thêm mới
                </Button>
              }
            />
            {loading ? (
              <EmptyState>Đang tải danh mục...</EmptyState>
            ) : categories.length ? (
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                    <TableRow>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">ID</TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">Tên</TableCell>
                      <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">Parent</TableCell>
                      <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium text-gray-500">Hành động</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {sortedCategories.map((category) => (
                      <TableRow 
                        key={category.id} 
                        className={category.isChild ? "bg-gray-50/50 dark:bg-gray-800/30" : ""} // Tô màu nền mờ cho danh mục con
                      >
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {category.isChild ? (
                            <span className="ml-4 text-gray-400">↳ #{category.id}</span>
                          ) : (
                            <span className="font-medium">#{category.id}</span>
                          )}
                        </TableCell>
                        <TableCell className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">
                          {category.isChild ? (
                            <span className="ml-4 text-gray-600 dark:text-gray-400">{category.name}</span>
                          ) : (
                            category.name
                          )}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {category.isChild ? (
                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                              Thuộc: {category.parentName}
                            </span>
                          ) : (
                            "Root"
                          )}
                        </TableCell>
                        <TableCell className="px-5 py-4 text-end">
                          <ActionButtons 
                            onEdit={() => { setEditingCategory(category); setCategoryModalOpen(true); }}
                            onDelete={() => { setDeleteTarget({ type: 'category', id: category.id, name: category.name }); setDeleteModalOpen(true); }}
                          />
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
            <PanelHeader 
              title="Phương thức thanh toán" 
              description="Nguồn: /api/payment-methods"
              action={
                <Button size="sm" onClick={() => { setEditingPayment(null); setPaymentModalOpen(true); }}>
                  + Thêm mới
                </Button>
              }
            />
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
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={method.enabled} />
                      <ActionButtons 
                        onEdit={() => { setEditingPayment(method); setPaymentModalOpen(true); }}
                        onDelete={() => { setDeleteTarget({ type: 'payment', id: method.code, name: method.name }); setDeleteModalOpen(true); }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>Chưa có phương thức thanh toán.</EmptyState>
            )}
          </Panel>
        </div>

        <Panel>
          <PanelHeader 
            title="Phương thức giao hàng" 
            description="Nguồn: /api/shipping-methods"
            action={
              <Button size="sm" onClick={() => { setEditingShipping(null); setShippingModalOpen(true); }}>
                + Thêm mới
              </Button>
            }
          />
          {loading ? (
            <EmptyState>Đang tải giao hàng...</EmptyState>
          ) : shippingMethods.length ? (
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                  <TableRow>
                    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">Tên</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">Thời gian</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">Phí</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500">Trạng thái</TableCell>
                    <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium text-gray-500">Hành động</TableCell>
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
                      <TableCell className="px-5 py-4 text-end">
                        <ActionButtons 
                          onEdit={() => { setEditingShipping(method); setShippingModalOpen(true); }}
                          onDelete={() => { setDeleteTarget({ type: 'shipping', id: method.id, name: method.name }); setDeleteModalOpen(true); }}
                        />
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

      {/* Modals */}
      <CategoryFormModal 
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSubmit={handleCategorySubmit}
        initialData={editingCategory}
        categories={categories}
      />

      <PaymentMethodFormModal 
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSubmit={handlePaymentSubmit}
        initialData={editingPayment}
      />

      <ShippingMethodFormModal 
        isOpen={shippingModalOpen}
        onClose={() => setShippingModalOpen(false)}
        onSubmit={handleShippingSubmit}
        initialData={editingShipping}
      />

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
        title="Xác nhận xoá"
        message={`Bạn có chắc chắn muốn xoá ${
          deleteTarget?.type === 'category' ? 'danh mục' : 
          deleteTarget?.type === 'payment' ? 'phương thức thanh toán' : 'phương thức giao hàng'
        } "${deleteTarget?.name}" không? Hành động này không thể hoàn tác.`}
      />
    </>
  );
}
