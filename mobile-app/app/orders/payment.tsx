import { Colors } from "@/constants/theme";
import {
  getPaymentMethodLabel,
  getPaymentStatusLabel,
} from "@/constants/order-status";
import { orderService } from "@/services/orderService";
import { Order, PaymentStatus, VietQrBankApp } from "@/types/order";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
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
  AppState,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ToastBanner from "@/components/ui/toast-banner";

const POLL_INTERVAL_MS = 5000;
const VIETQR_DEEPLINK_BASE_URL = "https://dl.vietqr.io/pay";

const FALLBACK_BANK_APPS: VietQrBankApp[] = [
  {
    app_id: "tcb",
    app_name: "Techcombank Mobile",
    bank_name: "Ngân hàng TMCP Kỹ thương Việt Nam",
    monthly_install: 200000,
    deeplink: "",
    autofill: false,
  },
  {
    app_id: "mb",
    app_name: "MB Bank",
    bank_name: "Ngân hàng TMCP Quân đội",
    monthly_install: 500000,
    deeplink: "",
    autofill: false,
  },
  {
    app_id: "vcb",
    app_name: "Vietcombank",
    bank_name: "Ngân hàng TMCP Ngoại thương Việt Nam",
    monthly_install: 300000,
    deeplink: "",
    autofill: false,
  },
  {
    app_id: "bidv",
    app_name: "BIDV SmartBanking",
    bank_name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
    monthly_install: 200000,
    deeplink: "",
    autofill: true,
  },
  {
    app_id: "icb",
    app_name: "VietinBank iPay",
    bank_name: "Ngân hàng TMCP Công thương Việt Nam",
    monthly_install: 200000,
    deeplink: "",
    autofill: true,
  },
  {
    app_id: "vpb",
    app_name: "VPBank NEO",
    bank_name: "Ngân hàng TMCP Việt Nam Thịnh Vượng",
    monthly_install: 200000,
    deeplink: "",
    autofill: false,
  },
  {
    app_id: "acb",
    app_name: "ACB One",
    bank_name: "Ngân hàng TMCP Á Châu",
    monthly_install: 70000,
    deeplink: "",
    autofill: true,
  },
  {
    app_id: "tpb",
    app_name: "TPBank Mobile",
    bank_name: "Ngân hàng TMCP Tiên Phong",
    monthly_install: 80000,
    deeplink: "",
    autofill: false,
  },
];

const BANK_APP_PROBE_URLS: Record<string, string[]> = {
  mb: ["mbbank://"],
  cake: ["cake.vn://"],
  tcb: ["techcombank://", "tcb://"],
  vcb: ["vcbdigibank://", "vietcombank://"],
  bidv: ["bidvsmartbanking://", "bidv://"],
  icb: ["vietinbankipay://", "vietinbank://"],
  acb: ["acbmobile://", "acb://"],
  vpb: ["vpbankneo://", "vpbank://"],
  tpb: ["tpbank://", "tpb://"],
  hdb: ["hdbank://"],
  vib: ["vib://"],
  "vib-2": ["myvib://", "vib://"],
  shb: ["shbmobile://", "shb://"],
  vba: ["agribank://", "vba://"],
  ocb: ["ocbomni://", "ocb://"],
};

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

const hasValue = (value?: string | null) => Boolean(value?.trim());

const encodeQuery = (params: [string, string | null | undefined][]) =>
  params
    .filter(([, value]) => hasValue(value))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");

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
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankAppsLoading, setBankAppsLoading] = useState(false);
  const [bankApps, setBankApps] = useState<VietQrBankApp[]>(FALLBACK_BANK_APPS);
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
  const normalizedPaymentState = String(paymentState ?? "").toLowerCase();
  const isPaymentTerminal = terminalPaymentStatuses.has(normalizedPaymentState);
  const isPaymentExpiredByClock = Boolean(
    payment?.expired_at && Date.parse(payment.expired_at) <= Date.now(),
  );
  const isPaymentActionClosed = isPaymentTerminal || isPaymentExpiredByClock;
  const isQrPayment = paymentMethod === "SEPAY_QR";
  const isCheckoutPayment =
    paymentMethod === "SEPAY_CHECKOUT" || paymentMethod === "SEPAY_CARD";

  const sortedBankApps = useMemo(
    () =>
      [...bankApps].sort((left, right) => {
        if (left.installed !== right.installed) {
          return left.installed ? -1 : 1;
        }
        if (left.autofill !== right.autofill) {
          return right.autofill ? 1 : -1;
        }
        return (right.monthly_install ?? 0) - (left.monthly_install ?? 0);
      }),
    [bankApps],
  );

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

  useFocusEffect(
    useCallback(() => {
      void loadOrder();
    }, [loadOrder]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void loadOrder();
      }
    });

    return () => subscription.remove();
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
    if (normalizedPaymentState && terminalPaymentStatuses.has(normalizedPaymentState)) {
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
  }, [normalizedPaymentState, parsedOrderId]);

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

  const createBankDeepLink = useCallback(
    (appId?: string | null, scheme = VIETQR_DEEPLINK_BASE_URL) => {
      if (!payment) {
        return "";
      }

      const bankAlias = payment.bank_code || payment.bank_bin;
      const receiverAccount =
        payment.bank_account_number && bankAlias
          ? `${payment.bank_account_number}@${bankAlias}`
          : null;
      const amount = Number.isFinite(Number(payment.amount))
        ? String(Math.round(Number(payment.amount)))
        : null;
      const query = encodeQuery([
        ["app", appId],
        ["ba", receiverAccount],
        ["am", amount],
        ["tn", payment.transfer_content],
        ["bn", payment.account_name],
      ]);

      return `${scheme}${query ? `?${query}` : ""}`;
    },
    [payment],
  );

  const checkBankAppInstalled = useCallback(
    async (app: VietQrBankApp): Promise<VietQrBankApp> => {
      const probes = BANK_APP_PROBE_URLS[app.app_id] ?? [`${app.app_id}://`];
      for (const probe of probes) {
        try {
          if (await Linking.canOpenURL(probe)) {
            return { ...app, installed: true };
          }
        } catch (error) {
          void error;
        }
      }

      return { ...app, installed: false };
    },
    [],
  );

  const loadBankApps = useCallback(async () => {
    setBankAppsLoading(true);
    try {
      if (!payment?.payment_id) {
        throw new Error("Payment is not ready");
      }
      const apps = await orderService.getPaymentBankApps(
        payment.payment_id,
        Platform.OS,
      );
      const activeApps = apps.filter((app) => app.app_id && app.app_name);
      const checkedApps = await Promise.all(
        activeApps.map((app) => checkBankAppInstalled(app)),
      );
      if (checkedApps.length > 0) {
        setBankApps(checkedApps);
        return;
      }
      const checkedFallbackApps = await Promise.all(
        FALLBACK_BANK_APPS.map((app) =>
          checkBankAppInstalled({
            ...app,
            deeplink: createBankDeepLink(app.app_id),
          }),
        ),
      );
      setBankApps(checkedFallbackApps);
    } catch (error) {
      void error;
      const checkedFallbackApps = await Promise.all(
        FALLBACK_BANK_APPS.map((app) =>
          checkBankAppInstalled({
            ...app,
            deeplink: createBankDeepLink(app.app_id),
          }),
        ),
      );
      setBankApps(checkedFallbackApps);
    } finally {
      setBankAppsLoading(false);
    }
  }, [checkBankAppInstalled, createBankDeepLink, payment?.payment_id]);

  const openBankPicker = useCallback(() => {
    setBankPickerVisible(true);
    void loadBankApps();
  }, [loadBankApps]);

  const openBankApp = useCallback(
    async (app: VietQrBankApp) => {
      const deeplink = app.deeplink || createBankDeepLink(app.app_id);
      if (!deeplink) {
        setToast({
          message: "Chưa đủ thông tin để mở app ngân hàng.",
          type: "error",
        });
        return;
      }

      setBankPickerVisible(false);
      try {
        await Linking.openURL(deeplink);
      } catch (error) {
        void error;
        setToast({
          message:
            "Không thể mở app ngân hàng này. Bạn vẫn có thể tải QR hoặc copy nội dung chuyển khoản.",
          type: "error",
        });
      }
    },
    [createBankDeepLink],
  );

  const openSystemVietQrChooser = useCallback(async () => {
    const deeplink = createBankDeepLink(null, "vietqr://pay");
    if (!deeplink) {
      return;
    }

    setBankPickerVisible(false);
    try {
      await Linking.openURL(deeplink);
    } catch (error) {
      void error;
      setToast({
        message:
          "Thiết bị chưa có app hỗ trợ chuẩn VietQR chung. Vui lòng chọn app ngân hàng trong danh sách.",
        type: "info",
      });
    }
  }, [createBankDeepLink]);

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

        if (openBankAfterSave) {
          openBankPicker();
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
    [openBankPicker, payment],
  );

  const statusMessage = useMemo(() => {
    const statusLabel = getPaymentStatusLabel(paymentState);

    if (paymentState === "paid" || paymentState === "success") {
      return "Thanh toán thành công.";
    }
    if (isPaymentExpiredByClock) {
      return "Thanh toán đã hết hạn.";
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
    if (paymentState === "pending" || paymentState === "pending_payment") {
      return "Đang chờ xác nhận thanh toán.";
    }

    return statusLabel;
  }, [isPaymentExpiredByClock, paymentState]);

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
          <Text style={styles.metaText}>
            Phương thức: {getPaymentMethodLabel(paymentMethod)}
          </Text>
        </View>

        {isQrPayment && !isPaymentActionClosed ? (
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

            <View style={styles.bankActions}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={openBankPicker}
              >
                <Ionicons name="apps-outline" size={18} color="white" />
                <Text style={styles.primaryButtonText}>Chọn app ngân hàng</Text>
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
                  Tải QR & chọn app ngân hàng
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fallbackHint}>
              Chọn app ngân hàng để chuyển sang ứng dụng bạn muốn dùng. Nếu app
              không tự điền giao dịch, hãy quét QR từ ảnh đã lưu hoặc copy nội
              dung chuyển khoản.
            </Text>
          </View>
        ) : null}

        {isCheckoutPayment && !isPaymentActionClosed ? (
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

        {isPaymentActionClosed ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isPaymentExpiredByClock && !isPaymentTerminal
                ? "Thanh toán đã hết hạn"
                : "Thanh toán đã kết thúc"}
            </Text>
            <Text style={styles.description}>
              Mã QR hoặc đường dẫn thanh toán đã được ẩn để tránh thao tác thanh
              toán lặp. Nếu bạn đã chuyển khoản thêm, vui lòng liên hệ bộ phận
              hỗ trợ để đối soát giao dịch.
            </Text>
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
      <BankAppPickerModal
        visible={bankPickerVisible}
        loading={bankAppsLoading}
        apps={sortedBankApps}
        onClose={() => setBankPickerVisible(false)}
        onSelect={openBankApp}
        onOpenSystemChooser={openSystemVietQrChooser}
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

function BankAppPickerModal({
  visible,
  loading,
  apps,
  onClose,
  onSelect,
  onOpenSystemChooser,
}: {
  visible: boolean;
  loading: boolean;
  apps: VietQrBankApp[];
  onClose: () => void;
  onSelect: (app: VietQrBankApp) => void;
  onOpenSystemChooser: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <View style={styles.headerSide}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Chọn app ngân hàng</Text>
          <View style={styles.headerSide} />
        </View>

        <ScrollView style={styles.modalContent}>
          <TouchableOpacity
            style={styles.systemChooserCard}
            onPress={onOpenSystemChooser}
          >
            <View style={styles.bankIconFallback}>
              <Ionicons
                name="swap-horizontal-outline"
                size={22}
                color="white"
              />
            </View>
            <View style={styles.bankAppTextBlock}>
              <Text style={styles.bankAppName}>Tự chọn bằng hệ điều hành</Text>
              <Text style={styles.bankAppDescription}>
                Thử mở chuẩn VietQR chung nếu thiết bị có app hỗ trợ.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <View style={styles.modalSectionHeader}>
            <Text style={styles.modalSectionTitle}>App ngân hàng</Text>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.light.tint} />
            ) : null}
          </View>

          {apps.map((app) => (
            <TouchableOpacity
              key={app.app_id}
              style={styles.bankAppItem}
              onPress={() => onSelect(app)}
            >
              {app.app_logo ? (
                <Image source={{ uri: app.app_logo }} style={styles.bankLogo} />
              ) : (
                <View style={styles.bankIconFallback}>
                  <Ionicons name="card-outline" size={22} color="white" />
                </View>
              )}
              <View style={styles.bankAppTextBlock}>
                <View style={styles.bankAppTitleRow}>
                  <Text style={styles.bankAppName}>{app.app_name}</Text>
                  {app.installed ? (
                    <Text style={styles.installedBadge}>Đã cài</Text>
                  ) : null}
                </View>
                <Text style={styles.bankAppDescription}>{app.bank_name}</Text>
                {app.autofill ? (
                  <Text style={styles.autofillText}>
                    Có thể hỗ trợ điền nhanh
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
  modal: { flex: 1, backgroundColor: "#f5f5f5" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
    backgroundColor: Colors.light.tint,
  },
  modalContent: { flex: 1, padding: 12 },
  systemChooserCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fee2d5",
  },
  modalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  modalSectionTitle: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  bankAppItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  bankLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: "#f3f4f6",
  },
  bankIconFallback: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  bankAppTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  bankAppTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bankAppName: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    fontWeight: "700",
  },
  bankAppDescription: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
    lineHeight: 17,
  },
  installedBadge: {
    color: "#047857",
    backgroundColor: "#d1fae5",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: "700",
  },
  autofillText: {
    fontSize: 11,
    color: Colors.light.tint,
    marginTop: 4,
    fontWeight: "600",
  },
});
