export const ORDER_STATUS_LABELS: Record<string, string> = {
  all: "Tất cả",
  pending: "Chờ xác nhận",
  pending_payment: "Chờ thanh toán",
  paid: "Đã thanh toán",
  payment_expired: "Hết hạn thanh toán",
  confirmed: "Đã xác nhận",
  processing: "Đang xử lý",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

export function getOrderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function formatOrderDate(dateString: string) {
  const date = new Date(dateString);

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
