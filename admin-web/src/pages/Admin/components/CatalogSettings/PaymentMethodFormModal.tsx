import { useState, useEffect } from "react";
import { Modal } from "../../../../components/ui/modal";
import Button from "../../../../components/ui/button/Button";
import Input from "../../../../components/form/input/InputField";
import Checkbox from "../../../../components/form/input/Checkbox";
import Select from "../../../../components/form/Select";
import type { PaymentMethod, PaymentMethodPayload } from "../../../../types/api";

interface PaymentMethodFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: PaymentMethodPayload) => Promise<void>;
  initialData?: PaymentMethod | null;
}

export function PaymentMethodFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: PaymentMethodFormModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("OFFLINE");
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState<string>("99");
  const [features, setFeatures] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setCode(initialData.code);
        setName(initialData.name);
        setDescription(initialData.description || "");
        setType(initialData.type || "OFFLINE");
        setEnabled(initialData.enabled);
        setPriority(String(initialData.priority ?? 99));
        setFeatures(initialData.features?.join(", ") || "");
      } else {
        setCode("");
        setName("");
        setDescription("");
        setType("OFFLINE");
        setEnabled(true);
        setPriority("99");
        setFeatures("");
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError("Mã và Tên phương thức không được để trống");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onSubmit({
        code: code.trim(),
        name: name.trim(),
        description: description.trim(),
        type,
        enabled,
        priority: parseInt(priority) || 99,
        features: features.split(",").map(f => f.trim()).filter(Boolean),
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
        {initialData ? "Sửa phương thức thanh toán" : "Thêm phương thức thanh toán"}
      </h2>
      
      {error && (
        <div className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Mã (Code) <span className="text-error-500">*</span>
            </label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Vd: COD, VNPAY"
              disabled={isSubmitting || !!initialData}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Tên hiển thị <span className="text-error-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vd: Thanh toán khi nhận hàng"
              disabled={isSubmitting}
            />
          </div>
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
              Loại (Type)
            </label>
            <Select
              options={[
                { value: "OFFLINE", label: "OFFLINE" },
                { value: "ONLINE", label: "ONLINE" },
                { value: "BANK_TRANSFER", label: "BANK_TRANSFER" },
              ]}
              defaultValue={type}
              onChange={setType}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Thứ tự hiển thị
            </label>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="99"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Các tính năng (ngăn cách bởi dấu phẩy)
          </label>
          <Input
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder="Vd: fast, secure"
            disabled={isSubmitting}
          />
        </div>

        <div className="pt-2">
          <Checkbox
            checked={enabled}
            onChange={setEnabled}
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
