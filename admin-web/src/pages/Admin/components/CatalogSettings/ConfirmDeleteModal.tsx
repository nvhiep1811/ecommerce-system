import { Modal } from "../../../../components/ui/modal";
import Button from "../../../../components/ui/button/Button";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  isDeleting?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  isDeleting = false,
}: ConfirmDeleteModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white/90 mb-4">{title}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={isDeleting}>
          Hủy
        </Button>
        <Button 
          variant="primary" 
          onClick={onConfirm} 
          disabled={isDeleting}
          className="!bg-error-500 hover:!bg-error-600 ring-error-500"
        >
          {isDeleting ? "Đang xóa..." : "Xóa"}
        </Button>
      </div>
    </Modal>
  );
}
