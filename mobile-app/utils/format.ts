export const formatCurrencyVnd = (value?: number | null) => {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${Math.round(safeAmount).toLocaleString("vi-VN")} ₫`;
};

export const formatPercent = (value?: number | null) => {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${safeAmount.toLocaleString("vi-VN")}%`;
};
