import Badge from "../ui/badge/Badge";

type BadgeColor = "primary" | "success" | "error" | "warning" | "info" | "light" | "dark";

const statusColor = (status?: string): BadgeColor => {
  const normalized = String(status ?? "").toLowerCase();
  if (["delivered", "paid", "active", "enabled", "success", "confirmed"].includes(normalized)) {
    return "success";
  }
  if (["pending", "pending_payment", "processing", "shipping", "unpaid"].includes(normalized)) {
    return "warning";
  }
  if (["cancelled", "canceled", "payment_expired", "expired", "failed", "disabled"].includes(normalized)) {
    return "error";
  }
  if (["returned", "refunded"].includes(normalized)) {
    return "info";
  }
  return "light";
};

export default function StatusBadge({ status }: { status?: string | boolean }) {
  const label = typeof status === "boolean" ? (status ? "active" : "disabled") : status || "N/A";
  return (
    <Badge size="sm" color={statusColor(label)}>
      {label}
    </Badge>
  );
}
