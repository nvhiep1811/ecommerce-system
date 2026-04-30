import { Colors } from "@/constants/theme";
import { orderService } from "@/services/orderService";
import { Order, PaymentStatus } from "@/types/order";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ToastBanner from "@/components/ui/toast-banner";

const POLL_INTERVAL_MS = 5000;

const terminalPaymentStatuses = new Set([
  "paid",
  "success",
  "failed",
  "cancelled",
  "expired",
  "amount_mismatch",
]);

const formatMoney = (amount: number, currency = "VND") => {
  if (currency === "VND") {
    return formatCurrencyVnd(amount);
  }

  return `${amount.toFixed(2)} ${currency}`;
};

const formatCountdown = (expiredAt?: string | null) => {
  if (!expiredAt) {
    return "--:--";
  }

  const remainingMs = new Date(expiredAt).getTime() - Date.now();
  if (remainingMs <= 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const stripDataUriPrefix = (value: string) =>
  value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

const toImageDataUri = (value?: string | null) => {
  if (!value) {
    return null;
  }

  return value.startsWith("data:image/")
    ? value
    : `data:image/png;base64,${value}`;
};

const getStatusTone = (status?: string) => {
  switch ((status || "").toLowerCase()) {
    case "paid":
    case "success":
      return styles.statusSuccess;
    case "failed":
    case "cancelled":
    case "expired":
    case "amount_mismatch":
      return styles.statusError;
    default:
      return styles.statusPending;
  }
};

export default function PaymentScreen() {
  const { orderId, source } = useLocalSearchParams<{
    orderId?: string;
    source?: string;
  }>();
  const parsedOrderId = Number(Array.isArray(orderId) ? orderId[0] : orderId);
  const sourceValue = Array.isArray(source) ? source[0] : source;
  const openedFromOrderDetail = sourceValue === "order_detail";
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [checkoutOpened, setCheckoutOpened] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  const [countdown, setCountdown] = useState("--:--");
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);

  const payment = order?.payment;
  const qrImageUri =
    toImageDataUri(payment?.qr_image_base64) ?? payment?.qr_code_url ?? null;
  const paymentMethod = order?.payment_method ?? paymentStatus?.payment_method;
  const paymentState =
    paymentStatus?.payment_status ?? payment?.status ?? order?.payment_status;
  const isQrPayment = paymentMethod === "SEPAY_QR";
  const isCheckoutPayment =
    paymentMethod === "SEPAY_CHECKOUT" || paymentMethod === "SEPAY_CARD";

  const loadOrder = useCallback(async () => {
    if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
      setLoading(false);
      return;
    }

    try {
      const nextOrder = await orderService.refreshOrderById(parsedOrderId);
      setOrder(nextOrder);
      const status = await orderService.getPaymentStatus(parsedOrderId);
      setPaymentStatus(status);
    } catch (error) {
      void error;
      setToast({
        message: "Không thể tải thông tin thanh toán.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [parsedOrderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    setCountdown(formatCountdown(payment?.expired_at));
    const timer = setInterval(() => {
      setCountdown(formatCountdown(payment?.expired_at));
    }, 1000);

    return () => clearInterval(timer);
  }, [payment?.expired_at]);

  useEffect(() => {
    if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
      return;
    }
    if (paymentState && terminalPaymentStatuses.has(paymentState)) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const status = await orderService.getPaymentStatus(parsedOrderId);
        setPaymentStatus(status);
        setOrder((current) =>
          current
            ? {
                ...current,
                status: status.order_status,
                payment_status: status.payment_status,
              }
            : current,
        );
        if (terminalPaymentStatuses.has(status.payment_status)) {
          void orderService.refreshOrderById(parsedOrderId).then(setOrder);
        }
      } catch (error) {
        void error;
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [parsedOrderId, paymentState]);

  const openCheckout = useCallback(async () => {
    if (!payment?.checkout_url) {
      setToast({ message: "Chưa có đường dẫn thanh toán.", type: "error" });
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(payment.checkout_url);
    } catch (error) {
      void error;
      await Linking.openURL(payment.checkout_url);
    }
  }, [payment?.checkout_url]);

  useEffect(() => {
    if (
      order?.next_action === "OPEN_CHECKOUT_URL" &&
      payment?.checkout_url &&
      !checkoutOpened
    ) {
      setCheckoutOpened(true);
      void openCheckout();
    }
  }, [checkoutOpened, openCheckout, order?.next_action, payment?.checkout_url]);

  const copyText = async (value?: string | null, label = "nội dung") => {
    if (!value) {
      return;
    }

    await Clipboard.setStringAsync(value);
    setToast({ message: `Đã sao chép ${label}.`, type: "success" });
  };

  const openUrl = async (
    url?: string | null,
    errorMessage = "Đường dẫn không khả dụng",
  ) => {
    if (!url) {
      setToast({ message: errorMessage, type: "error" });
      return;
    }

    await Linking.openURL(url);
  };

  const saveQrImageToLibrary = useCallback(
    async (openBankAfterSave = false) => {
      if (!payment) {
        return;
      }

      if (!payment.qr_image_base64 && !payment.qr_code_url) {
        setToast({ message: "Chưa có ảnh QR để tải.", type: "error" });
        return;
      }

      if (!FileSystem.cacheDirectory) {
        setToast({
          message: "Thiết bị chưa hỗ trợ lưu ảnh QR.",
          type: "error",
        });
        return;
      }

      setSavingQr(true);
      try {
        const permission = await MediaLibrary.requestPermissionsAsync(true);
        if (!permission.granted && permission.accessPrivileges !== "limited") {
          setToast({
            message: "Ứng dụng cần quyền thư viện để lưu mã QR.",
            type: "error",
          });
          return;
        }

        const safeName = String(
          payment.invoice_number ?? payment.payment_id ?? Date.now(),
        ).replace(/[^a-zA-Z0-9_-]/g, "-");
        const fileUri = `${FileSystem.cacheDirectory}sepay-qr-${safeName}.png`;

        if (payment.qr_image_base64) {
          await FileSystem.writeAsStringAsync(
            fileUri,
            stripDataUriPrefix(payment.qr_image_base64),
            { encoding: FileSystem.EncodingType.Base64 },
          );
        } else if (payment.qr_code_url) {
          await FileSystem.downloadAsync(payment.qr_code_url, fileUri);
        }

        await MediaLibrary.saveToLibraryAsync(fileUri);
        setToast({ message: "Đã lưu mã QR vào thư viện.", type: "success" });

        if (openBankAfterSave && payment.bank_deep_link) {
          await Linking.openURL(payment.bank_deep_link);
        }
      } catch (error) {
        void error;
        setToast({
          message:
            "Không thể lưu mã QR. Vui lòng mở ảnh QR hoặc copy nội dung chuyển khoản.",
          type: "error",
        });
      } finally {
        setSavingQr(false);
      }
    },
    [payment],
  );

  const statusMessage = useMemo(() => {
    if (paymentStatus?.message) {
      return paymentStatus.message;
    }
    if (paymentState === "paid" || paymentState === "success") {
      return "Thanh toán thành công.";
    }
    if (paymentState === "expired") {
      return "Thanh toán đã hết hạn.";
    }
    if (paymentState === "failed" || paymentState === "cancelled") {
      return "Thanh toán chưa hoàn tất.";
    }
    if (paymentState === "amount_mismatch") {
      return "Số tiền thanh toán cần được kiểm tra.";
    }
    return "Đang chờ xác nhận thanh toán.";
  }, [paymentState, paymentStatus?.message]);

  const goToOrderDetail = useCallback(() => {
    if (!order) {
      return;
    }

    if (openedFromOrderDetail && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(`/orders/detail?orderId=${order.id}`);
  }, [openedFromOrderDetail, order]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order || !payment) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Thanh toán" />
        <View style={styles.center}>
          <Text style={styles.emptyText}>Chưa có thông tin thanh toán.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Thanh toán" onBack={goToOrderDetail} />
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.orderCode}>
            {order.order_no || `Đơn #${order.id}`}
          </Text>
          <View style={[styles.statusBadge, getStatusTone(paymentState)]}>
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Số tiền</Text>
            <Text style={styles.amountValue}>
              {formatMoney(payment.amount, payment.currency)}
            </Text>
          </View>
          <Text style={styles.metaText}>Phương thức: {paymentMethod}</Text>
        </View>

        {isQrPayment ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mã QR chuyển khoản</Text>
            {qrImageUri ? (
              <View style={styles.qrFrame}>
                <Image
                  source={{ uri: qrImageUri }}
                  style={styles.qrImage}
                  contentFit="contain"
                  contentPosition="center"
                />
              </View>
            ) : (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code-outline" size={56} color="#999" />
                <Text style={styles.emptyText}>Chưa có ảnh QR.</Text>
              </View>
            )}
            <View style={styles.countdownBox}>
              <Ionicons name="time-outline" size={18} color="#b45309" />
              <Text style={styles.countdownText}>Hết hạn sau {countdown}</Text>
            </View>

            <InfoRow label="Ngân hàng" value={payment.bank_name} />
            <InfoRow label="Số tài khoản" value={payment.bank_account_number} />
            <InfoRow label="Chủ tài khoản" value={payment.account_name} />
            <InfoRow
              label="Nội dung chuyển khoản"
              value={payment.transfer_content}
              selectable
            />

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() =>
                  copyText(payment.transfer_content, "nội dung chuyển khoản")
                }
              >
                <Ionicons
                  name="copy-outline"
                  size={18}
                  color={Colors.light.tint}
                />
                <Text style={styles.secondaryButtonText}>Sao chép</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => void saveQrImageToLibrary()}
                disabled={savingQr}
              >
                <Ionicons
                  name="download-outline"
                  size={18}
                  color={Colors.light.tint}
                />
                <Text style={styles.secondaryButtonText}>
                  {savingQr ? "Đang lưu..." : "Tải mã QR"}
                </Text>
              </TouchableOpacity>
            </View>

            {payment.bank_deep_link ? (
              <View style={styles.bankActions}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() =>
                    openUrl(
                      payment.bank_deep_link,
                      "Chưa có liên kết app ngân hàng.",
                    )
                  }
                >
                  <Ionicons name="open-outline" size={18} color="white" />
                  <Text style={styles.primaryButtonText}>Mở app ngân hàng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButtonWide}
                  onPress={() => void saveQrImageToLibrary(true)}
                  disabled={savingQr}
                >
                  <Ionicons
                    name="download-outline"
                    size={18}
                    color={Colors.light.tint}
                  />
                  <Text style={styles.secondaryButtonText}>
                    Tải QR & mở app ngân hàng
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.fallbackHint}>
                Mở app ngân hàng và chọn quét QR từ ảnh, hoặc nhập thủ công số
                tài khoản và nội dung chuyển khoản.
              </Text>
            )}
          </View>
        ) : null}

        {isCheckoutPayment ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thanh toán online</Text>
            <Text style={styles.description}>
              Hoàn tất thanh toán qua cổng SePay. Ứng dụng sẽ tự cập nhật khi
              cổng thanh toán xác nhận giao dịch.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openCheckout}
            >
              <Ionicons name="open-outline" size={18} color="white" />
              <Text style={styles.primaryButtonText}>Mở trang thanh toán</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trạng thái thanh toán</Text>
          <Text style={styles.description}>
            Ứng dụng kiểm tra trạng thái mỗi 5 giây khi giao dịch đang chờ xác
            nhận.
          </Text>
          <TouchableOpacity
            style={styles.secondaryButtonWide}
            onPress={() => void loadOrder()}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color={Colors.light.tint}
            />
            <Text style={styles.secondaryButtonText}>Cập nhật ngay</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={goToOrderDetail}
        >
          <Text style={styles.primaryButtonText}>Xem đơn hàng</Text>
        </TouchableOpacity>
      </View>

      <ToastBanner
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        <TouchableOpacity
          onPress={
            onBack ??
            (() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }

              router.replace("/(tabs)/profile");
            })
          }
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.headerSide} />
    </View>
  );
}

function InfoRow({
  label,
  value,
  selectable = false,
}: {
  label: string;
  value?: string | null;
  selectable?: boolean;
}) {
  if (!value) {
    return null;
  }

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable={selectable}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
    backgroundColor: Colors.light.tint,
  },
  headerSide: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    flex: 1,
    textAlign: "center",
  },
  content: { flex: 1, padding: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  section: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  orderCode: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginBottom: 10,
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  statusPending: { backgroundColor: "#fff3cd" },
  statusSuccess: { backgroundColor: "#d4edda" },
  statusError: { backgroundColor: "#f8d7da" },
  statusText: { fontSize: 13, fontWeight: "600", color: "#333" },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  amountLabel: { fontSize: 13, color: "#666" },
  amountValue: { fontSize: 18, fontWeight: "800", color: Colors.light.tint },
  metaText: { fontSize: 12, color: "#666", marginTop: 4 },
  qrFrame: {
    alignSelf: "center",
    width: 300,
    maxWidth: "100%",
    height: 348,
    backgroundColor: "white",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    padding: 8,
    marginBottom: 12,
  },
  qrImage: { width: "100%", height: "100%", borderRadius: 6 },
  qrPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    marginBottom: 12,
  },
  countdownBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff7ed",
    borderRadius: 6,
    paddingVertical: 8,
    marginBottom: 12,
  },
  countdownText: { color: "#b45309", fontWeight: "700" },
  infoRow: {
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  infoLabel: { fontSize: 12, color: "#777", marginBottom: 3 },
  infoValue: { fontSize: 14, color: "#222", fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  bankActions: { gap: 8, marginTop: 12 },
  primaryButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: { color: "white", fontSize: 15, fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  secondaryButtonWide: {
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: Colors.light.tint,
    fontSize: 13,
    fontWeight: "700",
  },
  description: {
    fontSize: 13,
    color: "#666",
    lineHeight: 19,
    marginBottom: 12,
  },
  fallbackHint: {
    color: "#666",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  emptyText: { color: "#666", fontSize: 14, textAlign: "center" },
  footer: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    padding: 12,
  },
});
