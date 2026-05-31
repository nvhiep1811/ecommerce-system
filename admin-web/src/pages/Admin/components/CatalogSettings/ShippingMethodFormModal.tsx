import { useState, useEffect } from "react";
import { Modal } from "../../../../components/ui/modal";
import Button from "../../../../components/ui/button/Button";
import Input from "../../../../components/form/input/InputField";
import Checkbox from "../../../../components/form/input/Checkbox";
import type { ShippingMethod, ShippingMethodPayload } from "../../../../types/api";

interface ShippingMethodFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ShippingMethodPayload) => Promise<void>;
  initialData?: ShippingMethod | null;
}

export function ShippingMethodFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: ShippingMethodFormModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedMinDays, setEstimatedMinDays] = useState<string>("");
  const [estimatedMaxDays, setEstimatedMaxDays] = useState<string>("");
  const [fee, setFee] = useState<string>("0");
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setDescription(initialData.description || "");
        setEstimatedMinDays(initialData.estimatedMinDays ? String(initialData.estimatedMinDays) : "");
        setEstimatedMaxDays(initialData.estimatedMaxDays ? String(initialData.estimatedMaxDays) : "");
        setFee(String(initialData.fee ?? 0));
        setActive(initialData.active);
      } else {
        setName("");
        setDescription("");
        setEstimatedMinDays("");
        setEstimatedMaxDays("");
        setFee("0");
        setActive(true);
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Tên phương thức không được để trống");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        estimatedMinDays: estimatedMinDays ? parseInt(estimatedMinDays) : null,
        estimatedMaxDays: estimatedMaxDays ? parseInt(estimatedMaxDays) : null,
        fee: parseInt(fee) || 0,
        active,
      });
      onClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi khi lưu");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white/90 mb-4">
        {initialData ? "Sửa phương thức giao hàng" : "Thêm phương thức giao hàng"}
      </h2>
      
      {error && (
        <div className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tên hiển thị <span className="text-error-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vd: Giao hàng nhanh"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Mô tả
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả chi tiết"
            disabled={isSubmitting}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Thời gian tối thiểu (ngày)
            </label>
            <Input
              type="number"
              value={estimatedMinDays}
              onChange={(e) => setEstimatedMinDays(e.target.value)}
              placeholder="Vd: 2"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Thời gian tối đa (ngày)
            </label>
            <Input
              type="number"
              value={estimatedMaxDays}
              onChange={(e) => setEstimatedMaxDays(e.target.value)}
              placeholder="Vd: 4"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Phí giao hàng (VNĐ)
          </label>
          <Input
            type="number"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="0"
            disabled={isSubmitting}
          />
        </div>

        <div className="pt-2">
          <Checkbox
            checked={active}
            onChange={setActive}
            label="Kích hoạt phương thức này"
            disabled={isSubmitting}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
