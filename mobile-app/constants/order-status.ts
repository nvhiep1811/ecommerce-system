export const ORDER_STATUS_LABELS: Record<string, string> = {
  all: "Tất cả",
  pending: "Chờ xác nhận",
  pending_payment: "Chờ thanh toán",
  paid: "Đã thanh toán",
  payment_expired: "Hết hạn thanh toán",
  confirmed: "Đã xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: "Thanh toán khi nhận hàng",
  sepay_qr: "Chuyển khoản QR SePay",
  sepay_checkout: "Thanh toán SePay",
  sepay_card: "Thẻ ngân hàng (SePay)",
  vnpay: "VNPay",
  momo: "Ví MoMo",
  paypal: "PayPal",
  card: "Thẻ ngân hàng",
  bank_transfer: "Chuyển khoản ngân hàng",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Chưa thanh toán",
  pending: "Đang chờ thanh toán",
  pending_payment: "Đang chờ thanh toán",
  processing: "Đang xử lý thanh toán",
  paid: "Đã thanh toán",
  success: "Thanh toán thành công",
  failed: "Thanh toán thất bại",
  cancelled: "Đã hủy thanh toán",
  expired: "Thanh toán đã hết hạn",
  payment_expired: "Thanh toán đã hết hạn",
  amount_mismatch: "Sai lệch số tiền thanh toán",
};

export const ORDER_STATUS_GROUPS: Record<string, string[]> = {
  pending: ["pending", "paid"],
  pending_payment: ["pending_payment"],
  paid: ["paid"],
  payment_expired: ["payment_expired"],
  confirmed: ["confirmed", "processing"],
  processing: ["processing"],
  shipped: ["shipped", "shipping"],
  shipping: ["shipped", "shipping"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

export function normalizeOrderStatus(status?: string | null) {
  return String(status ?? "").toLowerCase();
}

export function normalizePaymentMethod(method?: string | null) {
  return String(method ?? "")
    .trim()
    .toLowerCase();
}

export function normalizePaymentStatus(status?: string | null) {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

export function getOrderStatusLabel(status: string) {
  const normalized = normalizeOrderStatus(status);
  return ORDER_STATUS_LABELS[normalized] ?? status;
}

export function getPaymentMethodLabel(method?: string | null) {
  const normalized = normalizePaymentMethod(method);

  if (!normalized) {
    return "Thanh toán khi nhận hàng";
  }

  return PAYMENT_METHOD_LABELS[normalized] ?? String(method);
}

export function getPaymentStatusLabel(status?: string | null) {
  const normalized = normalizePaymentStatus(status);

  if (!normalized) {
    return "Chưa thanh toán";
  }

  return PAYMENT_STATUS_LABELS[normalized] ?? String(status);
}

export function orderMatchesStatusGroup(
  orderStatus?: string | null,
  selectedStatus?: string | null,
) {
  const selected = normalizeOrderStatus(selectedStatus || "pending");
  if (selected === "all") {
    return true;
  }

  const normalizedOrderStatus = normalizeOrderStatus(orderStatus);
  const group = ORDER_STATUS_GROUPS[selected] ?? [selected];
  return group.includes(normalizedOrderStatus);
}

export function isOrderWaitingSellerConfirmation(status?: string | null) {
  return orderMatchesStatusGroup(status, "pending");
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
