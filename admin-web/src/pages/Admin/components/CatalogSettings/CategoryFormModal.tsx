import { useState, useEffect } from "react";
import { Modal } from "../../../../components/ui/modal";
import Button from "../../../../components/ui/button/Button";
import Input from "../../../../components/form/input/InputField";
import Select from "../../../../components/form/Select";
import type { Category, CategoryPayload } from "../../../../types/api";

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CategoryPayload) => Promise<void>;
  initialData?: Category | null;
  categories: Category[]; // To show parent selection
}

export function CategoryFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  categories,
}: CategoryFormModalProps) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setParentId(initialData.parentId ? String(initialData.parentId) : "");
      } else {
        setName("");
        setParentId("");
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Tên danh mục không được để trống");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onSubmit({
        name: name.trim(),
        parentId: parentId ? Number(parentId) : null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi khi lưu");
    } finally {
      setIsSubmitting(false);
    }
  };

  const parentOptions = [
    { value: "", label: "Root (Không có)" },
    ...categories
      .filter((c) => c.id !== initialData?.id) // Prevent self-referencing
      .map((c) => ({
        value: String(c.id),
        label: c.name,
      })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white/90 mb-4">
        {initialData ? "Sửa danh mục" : "Thêm danh mục"}
      </h2>
      
      {error && (
        <div className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Tên danh mục <span className="text-error-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nhập tên danh mục"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Danh mục cha
          </label>
          <Select
            options={parentOptions}
            defaultValue={parentId}
            onChange={(val) => setParentId(val)}
            placeholder="Chọn danh mục cha"
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
