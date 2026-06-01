import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { addressService } from "@/services/addressService";
import { couponService } from "@/services/couponService";
import { orderService } from "@/services/orderService";
import { productService } from "@/services/productService";
import { Address } from "@/types/address";
import { Coupon } from "@/types/coupons";
import { Product } from "@/types/product";
import {
  OrderLineInput,
  OrderQuote,
  PaymentMethod,
  ShippingMethod,
} from "@/types/order";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import ToastBanner from "@/components/ui/toast-banner";

const FALLBACK_PAYMENT_METHODS: PaymentMethod[] = [
  {
    code: "COD",
    name: "Thanh toán khi nhận hàng",
    description: "Thanh toán tiền mặt khi nhận hàng.",
    enabled: true,
    type: "OFFLINE",
    priority: 1,
    features: [],
  },
];

const PAYMENT_ICON_BY_CODE: Record<string, keyof typeof Ionicons.glyphMap> = {
  COD: "cash-outline",
  SEPAY_QR: "qr-code-outline",
  SEPAY_CHECKOUT: "card-outline",
  SEPAY_CARD: "card-outline",
  APPLE_PAY: "logo-apple",
  GOOGLE_PAY: "logo-google",
};

const EMPTY_QUOTE: OrderQuote = {
  subtotal: 0,
  tax: 0,
  shipping_fee: 0,
  shipping_method_id: null,
  shipping_method_name: null,
  discount: 0,
  total: 0,
  payment_method: "COD",
  coupon: null,
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const parsePositiveNumber = (value?: string | string[]) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const formatCurrency = formatCurrencyVnd;

const formatWardDistrict = (ward?: string, district?: string) => {
  const w = (ward || "").trim();
  const d = (district || "").trim();

  if (w && d) {
    return `${w}, ${d}`;
  }

  return w || d || "-";
};

const formatCityProvince = (city?: string, province?: string) => {
  const c = (city || "").trim();
  const p = (province || "").trim();

  if (c && p && c.toLowerCase() !== p.toLowerCase()) {
    return `${c}, ${p}`;
  }

  return c || p || "-";
};

const formatCityProvincePostal = (
  city?: string,
  province?: string,
  postalCode?: string,
) => {
  const cityProvince = formatCityProvince(city, province);
  const postal = (postalCode || "").trim();

  if (!postal) {
    return cityProvince;
  }

  if (cityProvince === "-") {
    return postal;
  }

  return `${cityProvince}, ${postal}`;
};

const formatShippingEta = (
  minDays?: number | null,
  maxDays?: number | null,
) => {
  if (minDays != null && maxDays != null) {
    return minDays === maxDays
      ? `${minDays} ngày`
      : `${minDays}-${maxDays} ngày`;
  }

  if (minDays != null) {
    return `Từ ${minDays} ngày`;
  }

  if (maxDays != null) {
    return `Tối đa ${maxDays} ngày`;
  }

  return null;
};

const normalizeOptionText = (value: string) =>
  value
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isStandardShippingMethod = (method: ShippingMethod) => {
  const searchableText = normalizeOptionText(
    `${method.name} ${method.description ?? ""}`,
  );

  return (
    searchableText.includes("giao hang tieu chuan") ||
    searchableText.includes("standard")
  );
};

const getDefaultShippingMethod = (methods: ShippingMethod[]) =>
  methods.find(isStandardShippingMethod) ?? methods[0] ?? null;

const getDefaultPaymentMethod = (methods: PaymentMethod[]) =>
  methods.find((method) => method.enabled && method.code === "COD") ??
  methods.find((method) => method.enabled) ??
  null;

const getCouponUnavailableReason = (
  coupon: Coupon,
  orderValue: number,
  nowMs: number,
) => {
  if (!coupon.active) {
    return "Mã này hiện không khả dụng.";
  }

  if (coupon.start_date && nowMs < new Date(coupon.start_date).getTime()) {
    return "Mã này chưa đến thời gian sử dụng.";
  }

  if (coupon.end_date && nowMs > new Date(coupon.end_date).getTime()) {
    return "Mã này đã hết hạn.";
  }

  if (
    coupon.usage_limit != null &&
    (coupon.used_count ?? 0) >= coupon.usage_limit
  ) {
    return "Mã này đã hết lượt sử dụng.";
  }

  if (orderValue < (coupon.min_order_value ?? 0)) {
    return `Đơn tối thiểu ${formatCurrency(coupon.min_order_value ?? 0)}.`;
  }

  return null;
};

const calculateCouponDiscount = (coupon: Coupon, orderValue: number) => {
  const rawDiscount =
    coupon.discount_type === "percent"
      ? (orderValue * coupon.discount_value) / 100
      : coupon.discount_value;
  const cappedDiscount =
    coupon.max_discount != null
      ? Math.min(rawDiscount, coupon.max_discount)
      : rawDiscount;

  return Math.max(0, cappedDiscount);
};

const formatCouponRule = (coupon: Coupon) => {
  if (coupon.discount_type === "percent") {
    return `Giảm ${coupon.discount_value}%${
      coupon.max_discount != null
        ? `, tối đa ${formatCurrency(coupon.max_discount)}`
        : ""
    }`;
  }

  return `Giảm ${formatCurrency(coupon.discount_value)}`;
};

export default function InvoiceScreen() {
  const { cartItems, clearCart, removeManyFromCart } = useCart();
  const { user, profile } = useAuth();
  const {
    selected,
    addressId,
    buyNowProductId,
    buyNowVariantId,
    buyNowQuantity,
    flashSaleCampaignId,
    flashSaleItemId,
    flashSaleReservationToken,
    flashSalePrice,
  } = useLocalSearchParams<{
    selected?: string;
    addressId?: string;
    buyNowProductId?: string;
    buyNowVariantId?: string;
    buyNowQuantity?: string;
    flashSaleCampaignId?: string;
    flashSaleItemId?: string;
    flashSaleReservationToken?: string;
    flashSalePrice?: string;
  }>();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [selectedPayment, setSelectedPayment] = useState("COD");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(
    FALLBACK_PAYMENT_METHODS,
  );
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<
    number | null
  >(null);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [shippingMethodsLoading, setShippingMethodsLoading] = useState(false);
  const [paymentMethodError, setPaymentMethodError] = useState("");
  const [shippingMethodError, setShippingMethodError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(
    null,
  );
  const [couponError, setCouponError] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [couponModalVisible, setCouponModalVisible] = useState(false);
  const [couponSelectionTouched, setCouponSelectionTouched] = useState(false);
  const [suppressedAutoCouponCode, setSuppressedAutoCouponCode] = useState<
    string | null
  >(null);
  const [shippingMethodModalVisible, setShippingMethodModalVisible] =
    useState(false);
  const [paymentMethodModalVisible, setPaymentMethodModalVisible] =
    useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [confirmOptions, setConfirmOptions] = useState<{
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    loading?: boolean;
    onConfirm?: () => void;
  } | null>(null);
  const [invalidSelectionHandled, setInvalidSelectionHandled] = useState(false);
  const [directProduct, setDirectProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);
  const checkoutRequestIdRef = useRef(
    `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const selectedRaw = useMemo(
    () => (Array.isArray(selected) ? selected[0] : selected),
    [selected],
  );
  const selectedAddressIdRaw = useMemo(
    () => (Array.isArray(addressId) ? addressId[0] : addressId),
    [addressId],
  );
  const selectedAddressIdParam = useMemo(() => {
    if (!selectedAddressIdRaw) {
      return null;
    }

    const parsed = Number(selectedAddressIdRaw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [selectedAddressIdRaw]);

  const directProductId = useMemo(() => {
    const rawValue = Array.isArray(buyNowProductId)
      ? buyNowProductId[0]
      : buyNowProductId;

    if (!rawValue) {
      return null;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [buyNowProductId]);

  const directQuantity = useMemo(() => {
    const rawValue = Array.isArray(buyNowQuantity)
      ? buyNowQuantity[0]
      : buyNowQuantity;

    if (!rawValue) {
      return 1;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  }, [buyNowQuantity]);

  const directVariantId = useMemo(() => {
    const rawValue = Array.isArray(buyNowVariantId)
      ? buyNowVariantId[0]
      : buyNowVariantId;

    if (!rawValue) {
      return null;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [buyNowVariantId]);

  const directFlashSaleCampaignId = useMemo(
    () => parsePositiveNumber(flashSaleCampaignId),
    [flashSaleCampaignId],
  );
  const directFlashSaleItemId = useMemo(
    () => parsePositiveNumber(flashSaleItemId),
    [flashSaleItemId],
  );
  const directFlashSalePrice = useMemo(
    () => parsePositiveNumber(flashSalePrice),
    [flashSalePrice],
  );
  const directFlashSaleReservationToken = useMemo(() => {
    const rawValue = Array.isArray(flashSaleReservationToken)
      ? flashSaleReservationToken[0]
      : flashSaleReservationToken;
    const trimmed = rawValue?.trim();
    return trimmed || null;
  }, [flashSaleReservationToken]);

  const directFlashSaleLine = useMemo(() => {
    if (
      !directFlashSaleCampaignId ||
      !directFlashSaleItemId ||
      !directFlashSaleReservationToken
    ) {
      return null;
    }

    return {
      campaignId: directFlashSaleCampaignId,
      itemId: directFlashSaleItemId,
      reservationToken: directFlashSaleReservationToken,
      price: directFlashSalePrice,
    };
  }, [
    directFlashSaleCampaignId,
    directFlashSaleItemId,
    directFlashSalePrice,
    directFlashSaleReservationToken,
  ]);

  const hasSelectedParam = Boolean(selectedRaw?.trim());
  const isDirectCheckout = directProductId !== null;

  const selectedItemKeys = useMemo(() => {
    if (!selectedRaw) {
      return new Set<string>();
    }

    return new Set(
      selectedRaw
        .split(",")
        .map((value: string) => value.trim())
        .filter(Boolean),
    );
  }, [selectedRaw]);

  const checkoutItems = useMemo(() => {
    if (isDirectCheckout && directProduct) {
      const product =
        directFlashSaleLine?.price != null
          ? { ...directProduct, price: directFlashSaleLine.price }
          : directProduct;

      return [
        {
          product,
          variant:
            directVariantId == null
              ? null
              : product.variants?.find((variant) => variant.id === directVariantId) ?? null,
          quantity: directQuantity,
        },
      ];
    }

    if (!hasSelectedParam) {
      return cartItems;
    }

    return cartItems.filter((item) =>
      selectedItemKeys.has(`${item.product.id}:${item.variant?.id ?? "default"}`) ||
      selectedItemKeys.has(String(item.product.id)),
    );
  }, [
    cartItems,
    directProduct,
    directFlashSaleLine,
    directVariantId,
    directQuantity,
    hasSelectedParam,
    isDirectCheckout,
    selectedItemKeys,
  ]);

  const missingSelectedCount = useMemo(() => {
    if (isDirectCheckout || !hasSelectedParam) {
      return 0;
    }

    return selectedItemKeys.size - checkoutItems.length;
  }, [
    checkoutItems.length,
    hasSelectedParam,
    isDirectCheckout,
    selectedItemKeys.size,
  ]);

  const buildOrderLineItems = useCallback((): OrderLineInput[] => {
    return checkoutItems.map((item) => {
      const line: OrderLineInput = {
        product_id: item.product.id,
        variant_id: item.variant?.id,
        quantity: item.quantity,
        price: item.variant?.price ?? item.product.price,
      };

      if (
        isDirectCheckout &&
        directFlashSaleLine &&
        directProductId === item.product.id
      ) {
        line.flash_sale_campaign_id = directFlashSaleLine.campaignId;
        line.flash_sale_item_id = directFlashSaleLine.itemId;
        line.flash_sale_reservation_token =
          directFlashSaleLine.reservationToken;
      }

      return line;
    });
  }, [checkoutItems, directFlashSaleLine, directProductId, isDirectCheckout]);

  const cartSubtotal = checkoutItems.reduce(
    (total, item) => total + (item.variant?.price ?? item.product.price) * item.quantity,
    0,
  );

  const couponOptions = useMemo(() => {
    const nowMs = Date.now();

    return availableCoupons
      .map((coupon) => {
        const unavailableReason = getCouponUnavailableReason(
          coupon,
          cartSubtotal,
          nowMs,
        );

        return {
          coupon,
          estimatedDiscount: unavailableReason
            ? 0
            : calculateCouponDiscount(coupon, cartSubtotal),
          unavailableReason,
        };
      })
      .sort((left, right) => {
        const leftAvailable = !left.unavailableReason;
        const rightAvailable = !right.unavailableReason;

        if (leftAvailable !== rightAvailable) {
          return leftAvailable ? -1 : 1;
        }

        if (right.estimatedDiscount !== left.estimatedDiscount) {
          return right.estimatedDiscount - left.estimatedDiscount;
        }

        return left.coupon.code.localeCompare(right.coupon.code);
      });
  }, [availableCoupons, cartSubtotal]);

  const bestCouponOption = useMemo(
    () =>
      couponOptions.find(
        (option) =>
          !option.unavailableReason &&
          option.coupon.code.toUpperCase() !== suppressedAutoCouponCode,
      ) ?? null,
    [couponOptions, suppressedAutoCouponCode],
  );

  const selectedCouponOption = useMemo(() => {
    if (!appliedCouponCode) {
      return null;
    }

    return (
      couponOptions.find(
        (option) =>
          option.coupon.code.toUpperCase() ===
          appliedCouponCode.toUpperCase(),
      ) ?? null
    );
  }, [appliedCouponCode, couponOptions]);

  const availableCouponCount = useMemo(
    () => couponOptions.filter((option) => !option.unavailableReason).length,
    [couponOptions],
  );

  const enabledPaymentMethods = useMemo(
    () => paymentMethods.filter((method) => method.enabled),
    [paymentMethods],
  );

  const activeShippingMethods = useMemo(
    () => shippingMethods.filter((method) => method.active),
    [shippingMethods],
  );

  const activeAddress = useMemo(() => {
    if (addresses.length === 0) {
      return null;
    }

    return (
      addresses.find((address) => address.id === selectedAddress) ||
      addresses.find((address) => address.is_default) ||
      addresses[0]
    );
  }, [addresses, selectedAddress]);

  const selectedPaymentMethod = useMemo(
    () => paymentMethods.find((method) => method.code === selectedPayment),
    [paymentMethods, selectedPayment],
  );

  const selectedShippingMethod = useMemo(
    () =>
      activeShippingMethods.find(
        (method) => method.id === selectedShippingMethodId,
      ) ?? null,
    [activeShippingMethods, selectedShippingMethodId],
  );

  const selectedShippingEta = useMemo(
    () =>
      selectedShippingMethod
        ? formatShippingEta(
            selectedShippingMethod.estimated_min_days,
            selectedShippingMethod.estimated_max_days,
          )
        : null,
    [selectedShippingMethod],
  );

  const checkoutItemCount = useMemo(
    () => checkoutItems.reduce((total, item) => total + item.quantity, 0),
    [checkoutItems],
  );

  const refreshAddresses = useCallback(
    async (preferredAddressId?: number | null) => {
      if (!user?.id) {
        return;
      }

      const data = await addressService.getAddressesByUser(user.id);
      let normalized = data;

      if (normalized.length === 1 && !normalized[0].is_default) {
        try {
          const updated = await addressService.setDefaultAddress(
            user.id,
            normalized[0].id,
          );
          normalized = [updated];
        } catch (error) {
          void error;
        }
      }

      setAddresses(normalized);

      if (
        preferredAddressId &&
        normalized.some((address) => address.id === preferredAddressId)
      ) {
        setSelectedAddress(preferredAddressId);
        return;
      }

      const defaultAddr = normalized.find((address) => address.is_default);
      setSelectedAddress(defaultAddr?.id || normalized[0]?.id || null);
    },
    [user?.id],
  );

  const refreshPaymentMethods = useCallback(async () => {
    setPaymentMethodsLoading(true);
    try {
      const methods = await orderService.getPaymentMethods();
      const nextMethods =
        methods.length > 0 ? methods : FALLBACK_PAYMENT_METHODS;
      setPaymentMethods(nextMethods);
      setPaymentMethodError("");
    } catch (error) {
      setPaymentMethods(FALLBACK_PAYMENT_METHODS);
      setSelectedPayment("COD");
      setPaymentMethodError(
        getErrorMessage(error, "Không thể tải phương thức thanh toán."),
      );
    } finally {
      setPaymentMethodsLoading(false);
    }
  }, []);

  const refreshShippingMethods = useCallback(async () => {
    setShippingMethodsLoading(true);
    try {
      const methods = await orderService.getShippingMethods();
      setShippingMethods(methods);
      setShippingMethodError("");
      setSelectedShippingMethodId((current) => {
        const activeMethods = methods.filter((method) => method.active);

        if (
          current &&
          activeMethods.some((method) => method.id === current)
        ) {
          return current;
        }

        return getDefaultShippingMethod(activeMethods)?.id ?? null;
      });
    } catch (error) {
      setShippingMethods([]);
      setSelectedShippingMethodId(null);
      setShippingMethodError(
        getErrorMessage(error, "Không thể tải phương thức giao hàng."),
      );
    } finally {
      setShippingMethodsLoading(false);
    }
  }, []);

  useEffect(() => {
    const selectedStillAvailable = paymentMethods.some(
      (method) => method.code === selectedPayment && method.enabled,
    );
    if (!selectedStillAvailable) {
      setSelectedPayment(
        getDefaultPaymentMethod(paymentMethods)?.code ?? "COD",
      );
    }
  }, [paymentMethods, selectedPayment]);

  useEffect(() => {
    const selectedStillAvailable = shippingMethods.some(
      (method) => method.id === selectedShippingMethodId && method.active,
    );

    if (!selectedStillAvailable) {
      setSelectedShippingMethodId(
        getDefaultShippingMethod(
          shippingMethods.filter((method) => method.active),
        )?.id ?? null,
      );
    }
  }, [selectedShippingMethodId, shippingMethods]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        await refreshPaymentMethods();
        await refreshShippingMethods();

        if (directProductId) {
          const product = await productService.getProductById(directProductId);
          setDirectProduct(product);
        }

        await refreshAddresses(selectedAddressIdParam);
      } catch (error) {
        void error;
      } finally {
        setLoading(false);
      }

      try {
        const coupons = await couponService.getCoupons();
        setAvailableCoupons(coupons);
      } catch (error) {
        void error;
      }
    };

    void bootstrap();
  }, [
    directProductId,
    refreshAddresses,
    refreshPaymentMethods,
    refreshShippingMethods,
    selectedAddressIdParam,
    user?.id,
  ]);

  useEffect(() => {
    if (!loading && selectedAddressIdParam) {
      void refreshAddresses(selectedAddressIdParam);
    }
  }, [loading, refreshAddresses, selectedAddressIdParam]);

  useEffect(() => {
    setSuppressedAutoCouponCode(null);
  }, [availableCoupons, cartSubtotal]);

  useEffect(() => {
    if (couponSelectionTouched) {
      return;
    }

    if (checkoutItems.length === 0 || !bestCouponOption) {
      if (appliedCouponCode) {
        setAppliedCoupon(null);
        setAppliedCouponCode(null);
        setCouponCode("");
        setCouponError("");
      }
      return;
    }

    const bestCode = bestCouponOption.coupon.code.toUpperCase();
    if (appliedCouponCode?.toUpperCase() === bestCode) {
      return;
    }

    setAppliedCoupon(bestCouponOption.coupon);
    setAppliedCouponCode(bestCode);
    setCouponCode(bestCode);
    setCouponError("");
  }, [
    appliedCouponCode,
    bestCouponOption,
    checkoutItems.length,
    couponSelectionTouched,
  ]);

  useEffect(() => {
    if (
      isDirectCheckout ||
      !hasSelectedParam ||
      invalidSelectionHandled ||
      orderPlaced ||
      loading
    ) {
      return;
    }

    if (selectedItemKeys.size === 0 || checkoutItems.length === 0) {
      setInvalidSelectionHandled(true);
      setConfirmOptions({
        title: "Lựa chọn thanh toán không hợp lệ",
        message:
          "Một số sản phẩm đã chọn không còn khả dụng. Vui lòng chọn lại trong giỏ hàng.",
        confirmLabel: "Về giỏ hàng",
        cancelLabel: "Hủy",
        onConfirm: () => {
          setConfirmOptions(null);
          router.replace("/(tabs)/cart");
        },
      });
    }
  }, [
    checkoutItems.length,
    hasSelectedParam,
    invalidSelectionHandled,
    isDirectCheckout,
    loading,
    orderPlaced,
    selectedItemKeys.size,
  ]);

  useEffect(() => {
    let cancelled = false;

    const syncQuote = async () => {
      if (!user?.id) {
        setQuote(null);
        setQuoteError("Vui lòng đăng nhập để tính tổng tiền.");
        setQuoteLoading(false);
        return;
      }

      if (checkoutItems.length === 0) {
        setQuote(EMPTY_QUOTE);
        setQuoteError("");
        setQuoteLoading(false);
        return;
      }

      setQuoteLoading(true);
      try {
        const nextQuote = await orderService.quoteOrder({
          address_id: selectedAddress,
          coupon_code: appliedCouponCode ?? undefined,
          payment_method: selectedPayment,
          shipping_method_id: selectedShippingMethodId,
          items: buildOrderLineItems(),
        });

        if (cancelled) {
          return;
        }

        setQuote(nextQuote);
        setQuoteError("");
        if (appliedCouponCode) {
          setCouponError("");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = getErrorMessage(error, "Không thể tính tổng đơn hàng");
        if (appliedCouponCode) {
          if (!couponSelectionTouched) {
            setSuppressedAutoCouponCode(appliedCouponCode.toUpperCase());
          }
          setQuote(null);
          setAppliedCoupon(null);
          setAppliedCouponCode(null);
          setCouponError(message);
          return;
        }

        setQuote(null);
        setQuoteError(message);
      } finally {
        if (!cancelled) {
          setQuoteLoading(false);
        }
      }
    };

    void syncQuote();

    return () => {
      cancelled = true;
    };
  }, [
    user?.id,
    selectedAddress,
    selectedPayment,
    selectedShippingMethodId,
    appliedCouponCode,
    buildOrderLineItems,
    couponSelectionTouched,
    checkoutItems,
  ]);

  const applyCouponCode = async (
    nextCouponCode: string,
    selectedCoupon?: Coupon,
  ) => {
    if (!user?.id) {
      setConfirmOptions({
        title: "Cần đăng nhập",
        message: "Vui lòng đăng nhập để áp dụng mã giảm giá",
        confirmLabel: "Đăng nhập",
        cancelLabel: "Hủy",
        onConfirm: () => {
          setConfirmOptions(null);
          router.navigate("/login");
        },
      });
      return false;
    }

    if (checkoutItems.length === 0) {
      setToast({
        message: "Vui lòng thêm sản phẩm trước khi áp dụng mã giảm giá.",
        type: "error",
      });
      return false;
    }

    const trimmedCode = nextCouponCode.trim().toUpperCase();
    if (!trimmedCode) {
      setCouponError("Vui lòng nhập mã giảm giá");
      return false;
    }

    setCouponError("");
    setQuoteLoading(true);

    try {
      const nextQuote = await orderService.quoteOrder({
        address_id: selectedAddress,
        coupon_code: trimmedCode,
        payment_method: selectedPayment,
        shipping_method_id: selectedShippingMethodId,
        items: buildOrderLineItems(),
      });

      setQuote(nextQuote);
      setQuoteError("");
      setAppliedCouponCode(trimmedCode);
      setAppliedCoupon(
        selectedCoupon ??
          availableCoupons.find(
            (coupon) => coupon.code.toUpperCase() === trimmedCode,
          ) ??
          null,
      );
      setCouponCode(trimmedCode);
      setToast({
        message: `Đã áp dụng mã giảm giá${trimmedCode ? `: ${trimmedCode}` : ""}`,
        type: "success",
      });
      setSuppressedAutoCouponCode(null);
      return true;
    } catch (error) {
      const message = getErrorMessage(error, "Không thể áp dụng mã giảm giá");
      setAppliedCoupon(null);
      setAppliedCouponCode(null);
      setCouponError(message);

      try {
        const fallbackQuote = await orderService.quoteOrder({
          address_id: selectedAddress,
          payment_method: selectedPayment,
          shipping_method_id: selectedShippingMethodId,
          items: buildOrderLineItems(),
        });
        setQuote(fallbackQuote);
        setQuoteError("");
      } catch (fallbackError) {
        setQuote(null);
        setQuoteError(
          getErrorMessage(fallbackError, "Không thể tính tổng đơn hàng"),
        );
      }
      return false;
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleApplyCoupon = async () => {
    setCouponSelectionTouched(true);
    const applied = await applyCouponCode(couponCode);
    if (applied) {
      setCouponModalVisible(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponSelectionTouched(true);
    setAppliedCoupon(null);
    setAppliedCouponCode(null);
    setCouponCode("");
    setCouponError("");
    setCouponModalVisible(false);
  };

  const openCouponModal = () => {
    setCouponModalVisible(true);
  };

  const selectCoupon = (coupon: Coupon) => {
    setCouponSelectionTouched(true);
    setCouponCode(coupon.code);
    void applyCouponCode(coupon.code, coupon).then((applied) => {
      if (applied) {
        setCouponModalVisible(false);
      }
    });
  };

  const openShippingMethodModal = () => {
    if (shippingMethodsLoading || activeShippingMethods.length === 0) {
      return;
    }

    setShippingMethodModalVisible(true);
  };

  const selectShippingMethod = (method: ShippingMethod) => {
    setSelectedShippingMethodId(method.id);
    setShippingMethodModalVisible(false);
  };

  const openPaymentMethodModal = () => {
    if (paymentMethodsLoading || paymentMethods.length === 0) {
      return;
    }

    setPaymentMethodModalVisible(true);
  };

  const selectPaymentMethod = (method: PaymentMethod) => {
    if (!method.enabled) {
      return;
    }

    setSelectedPayment(method.code);
    setPaymentMethodModalVisible(false);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/cart");
  };

  const handleOpenAddressManager = () => {
    router.push({
      pathname: "/orders/addresses",
      params: {
        ...(selectedRaw ? { selected: selectedRaw } : {}),
        ...(activeAddress?.id
          ? { selectedAddressId: String(activeAddress.id) }
          : {}),
        ...(isDirectCheckout && directProductId
          ? { buyNowProductId: String(directProductId) }
          : {}),
        ...(isDirectCheckout ? { buyNowQuantity: String(directQuantity) } : {}),
        ...(directFlashSaleLine
          ? {
              flashSaleCampaignId: String(directFlashSaleLine.campaignId),
              flashSaleItemId: String(directFlashSaleLine.itemId),
              flashSaleReservationToken: directFlashSaleLine.reservationToken,
            }
          : {}),
        ...(directFlashSaleLine?.price != null
          ? { flashSalePrice: String(directFlashSaleLine.price) }
          : {}),
      },
    });
  };

  const handlePlaceOrder = async () => {
    if (!user?.id) {
      setConfirmOptions({
        title: "Cần đăng nhập",
        message: "Vui lòng đăng nhập để đặt hàng",
        confirmLabel: "Đăng nhập",
        cancelLabel: "Hủy",
        onConfirm: () => {
          setConfirmOptions(null);
          router.navigate("/login");
        },
      });
      return;
    }

    if (!selectedAddress) {
      setToast({ message: "Vui lòng chọn địa chỉ giao hàng.", type: "error" });
      return;
    }

    if (checkoutItems.length === 0) {
      setToast({
        message: "Vui lòng thêm sản phẩm trước khi đặt hàng.",
        type: "error",
      });
      return;
    }

    if (!quote) {
      setToast({
        message: "Vui lòng chờ hệ thống tính tổng đơn hàng.",
        type: "info",
      });
      return;
    }

    if (
      !enabledPaymentMethods.some((method) => method.code === selectedPayment)
    ) {
      setToast({
        message: "Vui lòng chọn phương thức thanh toán khả dụng.",
        type: "error",
      });
      return;
    }

    if (
      activeShippingMethods.length > 0 &&
      !activeShippingMethods.some(
        (method) => method.id === selectedShippingMethodId,
      )
    ) {
      setToast({
        message: "Vui lòng chọn phương thức giao hàng khả dụng.",
        type: "error",
      });
      return;
    }

    try {
      setSubmitting(true);
      const order = await orderService.createOrder({
        address_id: selectedAddress,
        coupon_code: appliedCouponCode ?? undefined,
        payment_method: selectedPayment,
        shipping_method_id: selectedShippingMethodId,
        client_request_id: checkoutRequestIdRef.current,
        items: buildOrderLineItems(),
      });

      setOrderPlaced(true);
      setInvalidSelectionHandled(false);

      if (!isDirectCheckout && selectedItemKeys.size > 0) {
        removeManyFromCart(
          checkoutItems.map((item) => ({
            productId: item.product.id,
            variantId: item.variant?.id ?? null,
          })),
        );
      } else if (!isDirectCheckout) {
        clearCart();
      }

      if (
        order.next_action === "SHOW_QR" ||
        order.next_action === "OPEN_CHECKOUT_URL"
      ) {
        router.replace({
          pathname: "/orders/payment",
          params: { orderId: String(order.id), source: "checkout" },
        });
        return;
      }

      setConfirmOptions({
        title: "Đặt hàng thành công",
        message:
          order.next_action === "WAIT_FOR_SELLER_CONFIRMATION"
            ? `Đơn ${order.order_no || `#${order.id}`} đang chờ người bán xác nhận.`
            : `Đơn ${order.order_no || `#${order.id}`} đã được ghi nhận.`,
        confirmLabel: "Xem đơn hàng",
        cancelLabel: "Đóng",
        onConfirm: () => {
          setConfirmOptions(null);
          router.replace(`/orders/detail?orderId=${order.id}`);
        },
      });
    } catch (error) {
      setOrderPlaced(false);
      setToast({
        message: getErrorMessage(error, "Không thể đặt hàng"),
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const summaryRows = [
    {
      label: `Tạm tính (${checkoutItemCount} sản phẩm)`,
      value: formatCurrency(quote?.subtotal ?? cartSubtotal),
    },
    {
      label: "Thuế",
      value: quote ? formatCurrency(quote.tax) : "--",
    },
    {
      label: selectedShippingEta
        ? `Phí giao hàng (${selectedShippingEta})`
        : "Phí giao hàng",
      value: quote ? formatCurrency(quote.shipping_fee) : "--",
    },
    ...(quote && quote.discount > 0
      ? [{ label: "Giảm giá", value: `-${formatCurrency(quote.discount)}` }]
      : []),
  ];

  const footerTotalText = quote ? formatCurrency(quote.total) : "--";
  const placeOrderButtonLabel =
    selectedPaymentMethod?.type === "ONLINE" ? "Thanh toán" : "Đặt hàng";
  const selectedShippingDescription =
    selectedShippingMethod?.description ||
    (selectedShippingEta ? `Dự kiến: ${selectedShippingEta}` : "");
  const selectedPaymentDescription = selectedPaymentMethod?.description || "";
  const receiptEmail = String(profile?.email ?? user?.email ?? "").trim();
  const selectedCoupon = appliedCoupon ?? selectedCouponOption?.coupon ?? null;
  const selectedCouponDiscount =
    quote?.discount ??
    selectedCouponOption?.estimatedDiscount ??
    (selectedCoupon ? calculateCouponDiscount(selectedCoupon, cartSubtotal) : 0);
  const couponSummaryTitle = appliedCouponCode || "Chọn hoặc nhập mã";
  const couponSummaryDescription = appliedCouponCode
    ? selectedCoupon?.description ||
      (selectedCoupon ? formatCouponRule(selectedCoupon) : "Mã giảm giá đã áp dụng.")
    : availableCouponCount > 0
      ? `${availableCouponCount} voucher khả dụng, đã ưu tiên mã giảm nhiều nhất.`
      : "Nhập mã hoặc chọn voucher khi có mã khả dụng.";

  const placeOrderDisabled =
    orderPlaced ||
    invalidSelectionHandled ||
    submitting ||
    quoteLoading ||
    shippingMethodsLoading ||
    paymentMethodsLoading ||
    checkoutItems.length === 0 ||
    !selectedAddress ||
    !quote ||
    (activeShippingMethods.length > 0 && !selectedShippingMethodId) ||
    enabledPaymentMethods.length === 0;

  const placeOrderHint = useMemo(() => {
    if (orderPlaced) {
      return "Đơn hàng đã được tạo. Vui lòng xem chi tiết đơn hàng.";
    }
    if (invalidSelectionHandled) {
      return "Lựa chọn thanh toán không hợp lệ. Vui lòng quay lại giỏ hàng để chọn lại.";
    }
    if (
      submitting ||
      quoteLoading ||
      shippingMethodsLoading ||
      paymentMethodsLoading
    ) {
      return "";
    }
    if (checkoutItems.length === 0) {
      return "Không có sản phẩm để thanh toán.";
    }
    if (!selectedAddress) {
      return "Vui lòng chọn địa chỉ giao hàng.";
    }
    if (!quote) {
      return "Đang chờ tổng đơn hàng. Vui lòng thử lại sau giây lát.";
    }
    if (enabledPaymentMethods.length === 0) {
      return "Hiện chưa có phương thức thanh toán khả dụng.";
    }
    if (activeShippingMethods.length > 0 && !selectedShippingMethodId) {
      return "Vui lòng chọn phương thức giao hàng.";
    }
    return "";
  }, [
    activeShippingMethods.length,
    checkoutItems.length,
    enabledPaymentMethods.length,
    invalidSelectionHandled,
    orderPlaced,
    quote,
    quoteLoading,
    selectedAddress,
    selectedShippingMethodId,
    paymentMethodsLoading,
    shippingMethodsLoading,
    submitting,
  ]);

  const placeOrderHintTone = useMemo(() => {
    if (!placeOrderHint) {
      return null;
    }
    if (orderPlaced) {
      return "neutral";
    }
    if (invalidSelectionHandled || checkoutItems.length === 0) {
      return "error";
    }
    if (
      submitting ||
      quoteLoading ||
      shippingMethodsLoading ||
      paymentMethodsLoading
    ) {
      return "loading";
    }
    if (!selectedAddress || !quote) {
      return "warning";
    }
    return "neutral";
  }, [
    checkoutItems.length,
    invalidSelectionHandled,
    orderPlaced,
    placeOrderHint,
    quote,
    quoteLoading,
    selectedAddress,
    paymentMethodsLoading,
    shippingMethodsLoading,
    submitting,
  ]);

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View style={s.headerSide}>
          <TouchableOpacity onPress={handleBack} style={s.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={s.title}>Xác nhận thanh toán</Text>
        <View style={s.headerSide} />
      </View>

      <ScrollView
        style={s.content}
        contentContainerStyle={s.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Địa chỉ giao hàng</Text>
            <TouchableOpacity
              style={s.addBtn}
              onPress={handleOpenAddressManager}
            >
              <Text style={s.changeButtonText}>Thay đổi</Text>
            </TouchableOpacity>
          </View>

          {!activeAddress ? (
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={handleOpenAddressManager}
            >
              <Text style={s.emptyBtnText}>Quản lý địa chỉ</Text>
            </TouchableOpacity>
          ) : (
            <View style={[s.addressItem, s.addressItemSelected]}>
              <View style={s.addressMainRow}>
                <View style={s.addressIconCircle}>
                  <Ionicons name="location" size={20} color="white" />
                </View>
                <View style={s.flex1}>
                  <View style={s.addressTitleRow}>
                    <Text style={s.bold12}>{activeAddress.full_name}</Text>
                    {activeAddress.is_default ? (
                      <View style={s.defaultBadge}>
                        <Text style={s.defaultBadgeText}>Mặc định</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={s.text11}>{activeAddress.phone}</Text>
                  <Text style={s.text11}>{activeAddress.address_line}</Text>
                  <Text style={s.text11}>
                    {formatWardDistrict(
                      activeAddress.ward,
                      activeAddress.district,
                    )}
                  </Text>
                  <Text style={s.text11}>
                    {formatCityProvincePostal(
                      activeAddress.city,
                      activeAddress.province,
                      activeAddress.postal_code,
                    )}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={s.addressManageButton}
                onPress={handleOpenAddressManager}
              >
                <Text style={s.addressManageButtonText}>Quản lý địa chỉ</Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={Colors.light.tint}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Sản phẩm</Text>
          {missingSelectedCount > 0 ? (
            <Text style={s.warningText}>
              {missingSelectedCount} sản phẩm đã chọn không còn trong giỏ hàng
              và đã được loại khỏi lần thanh toán này.
            </Text>
          ) : null}
          {checkoutItems.map((item) => (
            <View key={item.product.id.toString()} style={s.productCard}>
              <Image
                source={
                  item.product.thumbnail
                    ? { uri: item.product.thumbnail }
                    : undefined
                }
                style={s.productImage}
              />
              <View style={s.flex1}>
                <Text style={s.bold13}>{item.product.name}</Text>
                <Text style={s.priceText}>
                  {formatCurrency(item.product.price)}
                </Text>
                {isDirectCheckout &&
                directFlashSaleLine &&
                item.product.id === directProductId ? (
                  <Text style={s.flashSaleLineText}>
                    Đã giữ suất flash sale
                  </Text>
                ) : null}
                <View style={s.quantityControl}>
                  <Ionicons name="layers-outline" size={16} color="#777" />
                  <Text style={s.quantity}>SL: {item.quantity}</Text>
                </View>
              </View>
              <Text style={s.priceText}>
                {formatCurrency(item.product.price * item.quantity)}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.summaryHeader}>
            <Text style={s.sectionTitle}>Phương thức giao hàng</Text>
            {shippingMethodsLoading ? (
              <ActivityIndicator size="small" color={Colors.light.tint} />
            ) : null}
          </View>
          {shippingMethodError ? (
            <Text style={s.warningText}>{shippingMethodError}</Text>
          ) : null}
          {activeShippingMethods.length === 0 && !shippingMethodsLoading ? (
            <Text style={s.warningText}>
              Chưa có phương thức giao hàng khả dụng.
            </Text>
          ) : null}
          {selectedShippingMethod ? (
            <TouchableOpacity
              style={s.methodSummaryRow}
              onPress={openShippingMethodModal}
              disabled={shippingMethodsLoading}
            >
              <View style={[s.methodIconCircle, s.shippingIconCircle]}>
                <Ionicons name="car-outline" size={20} color="#0f9f8f" />
              </View>
              <View style={s.methodSummaryText}>
                <Text style={s.methodName}>{selectedShippingMethod.name}</Text>
                {selectedShippingDescription ? (
                  <Text style={s.methodDescription}>
                    {selectedShippingDescription}
                  </Text>
                ) : null}
                {selectedShippingEta && selectedShippingMethod.description ? (
                  <Text style={s.methodDescription}>
                    Dự kiến: {selectedShippingEta}
                  </Text>
                ) : null}
              </View>
              <View style={s.methodTrailing}>
                <Text style={s.methodPriceText}>
                  {formatCurrency(selectedShippingMethod.fee)}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Voucher</Text>
          {couponError ? <Text style={s.errorText}>{couponError}</Text> : null}
          <TouchableOpacity
            style={s.methodSummaryRow}
            onPress={openCouponModal}
          >
            <View style={[s.methodIconCircle, s.voucherIconCircle]}>
              <Ionicons
                name="ticket-outline"
                size={20}
                color={Colors.light.tint}
              />
            </View>
            <View style={s.methodSummaryText}>
              <Text style={s.methodName}>{couponSummaryTitle}</Text>
              <Text style={s.methodDescription}>
                {couponSummaryDescription}
              </Text>
            </View>
            <View style={s.methodTrailing}>
              {appliedCouponCode && selectedCouponDiscount > 0 ? (
                <Text style={s.voucherSavingsText}>
                  -{formatCurrency(selectedCouponDiscount)}
                </Text>
              ) : (
                <Text style={s.methodChangeText}>
                  {appliedCouponCode ? "Thay đổi" : "Chọn"}
                </Text>
              )}
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={s.section}>
          <View style={s.summaryHeader}>
            <Text style={s.sectionTitle}>Phương thức thanh toán</Text>
            {paymentMethodsLoading ? (
              <ActivityIndicator size="small" color={Colors.light.tint} />
            ) : null}
          </View>
          {paymentMethodError ? (
            <Text style={s.warningText}>{paymentMethodError}</Text>
          ) : null}
          {enabledPaymentMethods.length === 0 && !paymentMethodsLoading ? (
            <Text style={s.warningText}>
              Chưa có phương thức thanh toán khả dụng.
            </Text>
          ) : null}
          {selectedPaymentMethod ? (
            <TouchableOpacity
              style={s.methodSummaryRow}
              onPress={openPaymentMethodModal}
              disabled={paymentMethodsLoading}
            >
              <View style={[s.methodIconCircle, s.paymentIconCircle]}>
                <Ionicons
                  name={
                    PAYMENT_ICON_BY_CODE[selectedPaymentMethod.code] ??
                    "wallet-outline"
                  }
                  size={20}
                  color={Colors.light.tint}
                />
              </View>
              <View style={s.methodSummaryText}>
                <Text style={s.methodName}>{selectedPaymentMethod.name}</Text>
                {selectedPaymentDescription ? (
                  <Text style={s.methodDescription}>
                    {selectedPaymentDescription}
                  </Text>
                ) : null}
              </View>
              <View style={s.methodTrailing}>
                <Text style={s.methodChangeText}>Thay đổi</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
            </TouchableOpacity>
          ) : null}
          {receiptEmail ? (
            <View style={s.receiptNotice}>
              <Ionicons name="mail-outline" size={16} color={Colors.light.tint} />
              <Text style={s.receiptNoticeText}>
                Hóa đơn và trạng thái thanh toán sẽ được gửi tới{" "}
                <Text style={s.receiptNoticeEmail}>{receiptEmail}</Text>
              </Text>
            </View>
          ) : null}
        </View>

        <View style={s.summaryBox}>
          <View style={s.summaryHeader}>
            <Text style={s.sectionTitle}>Tổng đơn hàng</Text>
            {quoteLoading ? (
              <ActivityIndicator size="small" color={Colors.light.tint} />
            ) : null}
          </View>
          {quoteError ? <Text style={s.errorText}>{quoteError}</Text> : null}
          {summaryRows.map((row) => (
            <View key={row.label} style={s.summaryRow}>
              <Text style={s.summaryLabelText}>{row.label}</Text>
              <Text style={s.summaryValueText}>{row.value}</Text>
            </View>
          ))}
          <View style={s.summaryRowTotal}>
            <Text style={s.totalLabel}>Tổng cộng</Text>
            <Text style={s.totalAmount}>{footerTotalText}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <View style={s.footerRow}>
          <View style={s.footerTotalBlock}>
            <Text style={s.footerTotalLabel}>Tổng thanh toán</Text>
            <Text style={s.footerTotalAmount}>{footerTotalText}</Text>
          </View>
          <TouchableOpacity
            style={[s.orderBtn, placeOrderDisabled && s.orderBtnDisabled]}
            disabled={placeOrderDisabled}
            onPress={handlePlaceOrder}
          >
            {submitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <View style={s.orderBtnContent}>
                <Ionicons name="lock-closed-outline" size={18} color="white" />
                <Text style={s.orderBtnText}>{placeOrderButtonLabel}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        {placeOrderHint ? (
          <Text
            style={[
              s.placeOrderHint,
              placeOrderHintTone === "error" && s.placeOrderHintError,
              placeOrderHintTone === "warning" && s.placeOrderHintWarning,
              placeOrderHintTone === "loading" && s.placeOrderHintLoading,
            ]}
          >
            {placeOrderHint}
          </Text>
        ) : null}
      </View>

      <Modal
        visible={couponModalVisible}
        animationType="slide"
        onRequestClose={() => setCouponModalVisible(false)}
      >
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <View style={s.modalHeaderSide}>
              <TouchableOpacity
                onPress={() => setCouponModalVisible(false)}
                style={s.modalHeaderButton}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <Text style={s.modalTitle}>Chọn mã giảm giá</Text>
            <View style={s.modalHeaderSide} />
          </View>

          <View style={s.modalContent}>
            <View style={s.couponEntryBox}>
              <TextInput
                style={[s.input, s.couponInput]}
                placeholder="Nhập mã giảm giá"
                value={couponCode}
                onChangeText={(text) => {
                  setCouponCode(text);
                  if (couponError) {
                    setCouponError("");
                  }
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[s.applyBtn, quoteLoading && s.applyBtnDisabled]}
                onPress={handleApplyCoupon}
                disabled={quoteLoading}
              >
                {quoteLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={s.applyBtnText}>Áp dụng</Text>
                )}
              </TouchableOpacity>
            </View>
            {couponError ? <Text style={s.errorText}>{couponError}</Text> : null}

            <ScrollView showsVerticalScrollIndicator={false}>
              {appliedCouponCode ? (
                <TouchableOpacity
                  style={s.couponItem}
                  onPress={handleRemoveCoupon}
                >
                  <View style={s.flex1}>
                    <Text style={s.bold13}>Không dùng voucher</Text>
                    <Text style={s.text11}>
                      Gỡ mã đang áp dụng khỏi đơn hàng.
                    </Text>
                  </View>
                  <Ionicons name="close" size={20} color="#dc2626" />
                </TouchableOpacity>
              ) : null}

              {couponOptions.length === 0 ? (
                <Text style={s.text13}>Không có mã giảm giá khả dụng</Text>
            ) : (
                couponOptions.map((option) => {
                  const item = option.coupon;
                  const selected =
                    appliedCouponCode?.toUpperCase() ===
                    item.code.toUpperCase();
                  const disabled = Boolean(option.unavailableReason);

                  return (
                    <TouchableOpacity
                      key={item.id.toString()}
                      style={[
                        s.couponItem,
                        selected && s.couponItemSelected,
                        disabled && s.couponItemDisabled,
                      ]}
                      disabled={disabled || quoteLoading}
                      onPress={() => selectCoupon(item)}
                    >
                      <View style={s.flex1}>
                        <View style={s.couponTitleRow}>
                          <Text style={s.bold13}>{item.code}</Text>
                          {option.estimatedDiscount > 0 ? (
                            <Text style={s.voucherSavingsText}>
                              -{formatCurrency(option.estimatedDiscount)}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={s.text11}>{item.description}</Text>
                        <Text style={s.text11}>{formatCouponRule(item)}</Text>
                        <Text
                          style={[
                            s.text11,
                            option.unavailableReason && s.couponDisabledText,
                          ]}
                        >
                          {option.unavailableReason ||
                            `Đơn tối thiểu: ${formatCurrency(
                              item.min_order_value ?? 0,
                            )}`}
                        </Text>
                      </View>
                      <Ionicons
                        name={selected ? "checkmark-circle" : "chevron-forward"}
                        size={20}
                        color={disabled ? "#9ca3af" : Colors.light.tint}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={shippingMethodModalVisible}
        animationType="slide"
        onRequestClose={() => setShippingMethodModalVisible(false)}
      >
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <View style={s.modalHeaderSide}>
              <TouchableOpacity
                onPress={() => setShippingMethodModalVisible(false)}
                style={s.modalHeaderButton}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <Text style={s.modalTitle}>Chọn phương thức giao hàng</Text>
            <View style={s.modalHeaderSide} />
          </View>

          <ScrollView style={s.modalContent}>
            {activeShippingMethods.length === 0 ? (
              <Text style={s.text13}>Không có phương thức giao hàng khả dụng</Text>
            ) : (
              activeShippingMethods.map((method) => {
                const eta = formatShippingEta(
                  method.estimated_min_days,
                  method.estimated_max_days,
                );
                const selected = selectedShippingMethodId === method.id;

                return (
                  <TouchableOpacity
                    key={method.id.toString()}
                    style={[s.methodOption, selected && s.methodOptionSelected]}
                    onPress={() => selectShippingMethod(method)}
                  >
                    <View style={s.radio}>
                      {selected ? <View style={s.radioDot} /> : null}
                    </View>
                    <Ionicons
                      name="car-outline"
                      size={20}
                      color={selected ? Colors.light.tint : "#999"}
                    />
                    <View style={s.paymentTextBlock}>
                      <View style={s.paymentTitleRow}>
                        <Text style={s.methodOptionTitle}>{method.name}</Text>
                        <Text style={s.shippingFeeText}>
                          {formatCurrency(method.fee)}
                        </Text>
                      </View>
                      {method.description ? (
                        <Text style={s.paymentDescription}>
                          {method.description}
                        </Text>
                      ) : null}
                      {eta ? (
                        <Text style={s.paymentDescription}>Dự kiến: {eta}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={paymentMethodModalVisible}
        animationType="slide"
        onRequestClose={() => setPaymentMethodModalVisible(false)}
      >
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <View style={s.modalHeaderSide}>
              <TouchableOpacity
                onPress={() => setPaymentMethodModalVisible(false)}
                style={s.modalHeaderButton}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <Text style={s.modalTitle}>Chọn phương thức thanh toán</Text>
            <View style={s.modalHeaderSide} />
          </View>

          <ScrollView style={s.modalContent}>
            {paymentMethods.length === 0 ? (
              <Text style={s.text13}>
                Không có phương thức thanh toán khả dụng
              </Text>
            ) : (
              paymentMethods.map((method) => {
                const selected = selectedPayment === method.code;

                return (
                  <TouchableOpacity
                    key={method.code}
                    style={[
                      s.methodOption,
                      selected && s.methodOptionSelected,
                      !method.enabled && s.paymentItemDisabled,
                    ]}
                    disabled={!method.enabled}
                    onPress={() => selectPaymentMethod(method)}
                  >
                    <View style={s.radio}>
                      {selected ? <View style={s.radioDot} /> : null}
                    </View>
                    <Ionicons
                      name={PAYMENT_ICON_BY_CODE[method.code] ?? "wallet-outline"}
                      size={20}
                      color={selected ? Colors.light.tint : "#999"}
                    />
                    <View style={s.paymentTextBlock}>
                      <View style={s.paymentTitleRow}>
                        <Text style={s.methodOptionTitle}>{method.name}</Text>
                        {!method.enabled ? (
                          <Text style={s.disabledBadge}>Không khả dụng</Text>
                        ) : null}
                      </View>
                      {method.description ? (
                        <Text style={s.paymentDescription}>
                          {method.description}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <ConfirmActionModal
        visible={!!confirmOptions}
        title={confirmOptions?.title || ""}
        message={confirmOptions?.message || ""}
        confirmLabel={confirmOptions?.confirmLabel || "Đồng ý"}
        cancelLabel={confirmOptions?.cancelLabel}
        destructive={!!confirmOptions?.destructive}
        loading={!!confirmOptions?.loading}
        onConfirm={() => {
          // call provided handler (it should clear confirmOptions)
          try {
            confirmOptions?.onConfirm?.();
          } catch (e) {
            void e;
            setConfirmOptions(null);
          }
        }}
        onCancel={() => setConfirmOptions(null)}
      />
      <ToastBanner
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
  content: { flex: 1, paddingHorizontal: 12 },
  contentContainer: {
    paddingTop: 12,
    paddingBottom: 18,
  },
  section: {
    marginBottom: 12,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "bold", marginBottom: 10 },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addBtn: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff1ed",
    borderWidth: 1,
    borderColor: "#ffd4c7",
  },
  changeButtonText: {
    color: Colors.light.tint,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyBtn: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  emptyBtnText: { color: "white", fontWeight: "600" },
  addressItem: {
    padding: 0,
    borderRadius: 0,
    marginBottom: 0,
    borderWidth: 0,
    borderColor: "transparent",
  },
  addressMainRow: { flexDirection: "row", alignItems: "flex-start" },
  addressIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  addressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
    gap: 8,
  },
  defaultBadge: {
    borderWidth: 1,
    borderColor: Colors.light.tint,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    color: Colors.light.tint,
    fontSize: 10,
    fontWeight: "700",
  },
  addressItemSelected: { borderColor: "transparent" },
  addressManageButton: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  addressManageButtonText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  productImage: { width: 68, height: 68, borderRadius: 8, marginRight: 10 },
  quantityControl: { flexDirection: "row", alignItems: "center", gap: 8 },
  quantity: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 20,
    textAlign: "center",
  },
  warningText: { fontSize: 12, color: "#b45309", marginBottom: 8 },
  methodSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 66,
    paddingVertical: 4,
  },
  methodIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  shippingIconCircle: {
    backgroundColor: "#e6fffb",
  },
  paymentIconCircle: {
    backgroundColor: "#fff1ed",
  },
  voucherIconCircle: {
    backgroundColor: "#fff7ed",
  },
  methodSummaryText: {
    flex: 1,
    minWidth: 0,
  },
  methodName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  methodDescription: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 17,
    marginTop: 2,
  },
  receiptNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  receiptNoticeText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
    color: "#4b5563",
  },
  receiptNoticeEmail: {
    color: "#111827",
    fontWeight: "700",
  },
  methodTrailing: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginLeft: 8,
  },
  methodPriceText: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: "700",
  },
  methodChangeText: {
    color: Colors.light.tint,
    fontSize: 12,
    fontWeight: "700",
  },
  voucherSavingsText: {
    color: Colors.light.tint,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },
  methodOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "white",
  },
  methodOptionSelected: {
    borderColor: Colors.light.tint,
    backgroundColor: "#fff7f4",
  },
  methodOptionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  paymentItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  paymentItemSelected: { borderColor: Colors.light.tint },
  paymentItemDisabled: {
    opacity: 0.55,
    backgroundColor: "#f6f6f6",
  },
  paymentTextBlock: {
    flex: 1,
    marginLeft: 8,
  },
  paymentTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  paymentDescription: {
    fontSize: 11,
    color: "#666",
    marginTop: 3,
    lineHeight: 16,
  },
  shippingFeeText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: "700",
  },
  disabledBadge: {
    fontSize: 10,
    color: "#777",
    backgroundColor: "#ececec",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.tint,
  },
  summaryBox: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  summaryLabelText: {
    flex: 1,
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 18,
  },
  summaryValueText: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
    textAlign: "right",
  },
  summaryRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: { fontSize: 15, fontWeight: "700", color: "#111827" },
  totalAmount: { fontSize: 22, fontWeight: "800", color: Colors.light.tint },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 6,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  footerTotalBlock: {
    flex: 1,
    minWidth: 0,
  },
  footerTotalLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 2,
  },
  footerTotalAmount: {
    fontSize: 20,
    color: Colors.light.tint,
    fontWeight: "800",
  },
  orderBtn: {
    flex: 1.1,
    backgroundColor: Colors.light.tint,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  orderBtnDisabled: {
    opacity: 0.48,
  },
  orderBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  orderBtnText: { color: "white", fontSize: 15, fontWeight: "bold" },
  placeOrderHint: {
    marginTop: 8,
    paddingHorizontal: 4,
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  placeOrderHintError: {
    color: "#dc2626",
  },
  placeOrderHintWarning: {
    color: "#b45309",
  },
  placeOrderHintLoading: {
    color: Colors.light.tint,
  },
  modal: { flex: 1, backgroundColor: "white" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 56,
    backgroundColor: Colors.light.tint,
  },
  modalHeaderSide: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderButton: {
    width: 40,
    height: 40,
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
  },
  modalContent: { flex: 1, padding: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
  },
  applyBtn: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  applyBtnDisabled: {
    opacity: 0.65,
  },
  applyBtnText: { color: "white", fontWeight: "600" },
  appliedCoupon: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    backgroundColor: "#f0f8ff",
  },
  errorText: { fontSize: 12, color: "red", marginBottom: 8 },
  couponEntryBox: {
    marginBottom: 12,
  },
  couponInput: {
    marginBottom: 8,
  },
  selectCouponBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: "#f9f9f9",
  },
  selectCouponBtnText: { fontSize: 13, fontWeight: "600", color: "#333" },
  couponItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "white",
  },
  couponItemSelected: {
    borderColor: Colors.light.tint,
    backgroundColor: "#fff7f4",
  },
  couponItemDisabled: {
    opacity: 0.55,
    backgroundColor: "#f9fafb",
  },
  couponTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  couponDisabledText: {
    color: "#b45309",
  },
  flex1: { flex: 1 },
  text11: { fontSize: 11, color: "#666" },
  text13: { fontSize: 13 },
  bold12: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  bold13: { fontSize: 13, fontWeight: "600", marginLeft: 8 },
  priceText: { fontSize: 13, fontWeight: "bold", color: Colors.light.tint },
  flashSaleLineText: {
    marginTop: 3,
    marginBottom: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#fff7ed",
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: "#b91c1c",
    fontSize: 11,
    fontWeight: "800",
  },
});
