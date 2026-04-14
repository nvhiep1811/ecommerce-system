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
import { OrderQuote } from "@/types/order";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const PAYMENT_METHODS = [
  { id: "MOMO", name: "MegaPay Wallet", icon: "wallet" },
  { id: "CARD", name: "Credit/Debit Card", icon: "card" },
  { id: "COD", name: "Cash on Delivery", icon: "cash" },
];

const EMPTY_QUOTE: OrderQuote = {
  subtotal: 0,
  tax: 0,
  shipping_fee: 0,
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

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

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

export default function InvoiceScreen() {
  const { cartItems, clearCart, removeFromCart } = useCart();
  const { user } = useAuth();
  const { selected, addressId, buyNowProductId, buyNowQuantity } =
    useLocalSearchParams<{
      selected?: string;
      addressId?: string;
      buyNowProductId?: string;
      buyNowQuantity?: string;
    }>();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<number | null>(null);
  const [selectedPayment, setSelectedPayment] = useState("MOMO");
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
  const [invalidSelectionHandled, setInvalidSelectionHandled] = useState(false);
  const [directProduct, setDirectProduct] = useState<Product | null>(null);

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

  const hasSelectedParam = Boolean(selectedRaw?.trim());
  const isDirectCheckout = directProductId !== null;

  const selectedProductIds = useMemo(() => {
    if (!selectedRaw) {
      return new Set<number>();
    }

    return new Set(
      selectedRaw
        .split(",")
        .map((value: string) => Number(value.trim()))
        .filter((value: number) => Number.isFinite(value) && value > 0),
    );
  }, [selectedRaw]);

  const checkoutItems = useMemo(() => {
    if (isDirectCheckout && directProduct) {
      return [
        {
          product: directProduct,
          quantity: directQuantity,
        },
      ];
    }

    if (!hasSelectedParam) {
      return cartItems;
    }

    return cartItems.filter((item) => selectedProductIds.has(item.product.id));
  }, [
    cartItems,
    directProduct,
    directQuantity,
    hasSelectedParam,
    isDirectCheckout,
    selectedProductIds,
  ]);

  const missingSelectedCount = useMemo(() => {
    if (isDirectCheckout || !hasSelectedParam) {
      return 0;
    }

    return selectedProductIds.size - checkoutItems.length;
  }, [
    checkoutItems.length,
    hasSelectedParam,
    isDirectCheckout,
    selectedProductIds.size,
  ]);

  const cartSubtotal = checkoutItems.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
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

  useEffect(() => {
    const bootstrap = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
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
  }, [directProductId, refreshAddresses, selectedAddressIdParam, user?.id]);

  useEffect(() => {
    if (!loading && selectedAddressIdParam) {
      void refreshAddresses(selectedAddressIdParam);
    }
  }, [loading, refreshAddresses, selectedAddressIdParam]);

  useEffect(() => {
    if (
      isDirectCheckout ||
      !hasSelectedParam ||
      invalidSelectionHandled ||
      loading
    ) {
      return;
    }

    if (selectedProductIds.size === 0 || checkoutItems.length === 0) {
      setInvalidSelectionHandled(true);
      Alert.alert(
        "Invalid checkout selection",
        "Selected products are no longer available. Please select items again from cart.",
        [
          {
            text: "Back to cart",
            onPress: () => router.replace("/(tabs)/cart"),
          },
        ],
      );
    }
  }, [
    checkoutItems.length,
    hasSelectedParam,
    invalidSelectionHandled,
    isDirectCheckout,
    loading,
    selectedProductIds.size,
  ]);

  useEffect(() => {
    let cancelled = false;

    const syncQuote = async () => {
      if (!user?.id) {
        setQuote(null);
        setQuoteError("Please log in to calculate final total.");
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
          items: checkoutItems.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
            price: item.product.price,
          })),
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

        const message = getErrorMessage(
          error,
          "Failed to calculate order summary",
        );
        if (appliedCouponCode) {
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
    appliedCouponCode,
    checkoutItems,
  ]);

  const applyCouponCode = async (
    nextCouponCode: string,
    selectedCoupon?: Coupon,
  ) => {
    if (!user?.id) {
      Alert.alert(
        "Authentication Required",
        "Please log in to apply a coupon",
        [
          { text: "Cancel" },
          { text: "Login", onPress: () => router.push("/login") },
        ],
      );
      return;
    }

    if (checkoutItems.length === 0) {
      Alert.alert("Empty Cart", "Add products before applying a coupon.");
      return;
    }

    const trimmedCode = nextCouponCode.trim().toUpperCase();
    if (!trimmedCode) {
      setCouponError("Please enter a coupon code");
      return;
    }

    setCouponError("");
    setQuoteLoading(true);

    try {
      const nextQuote = await orderService.quoteOrder({
        address_id: selectedAddress,
        coupon_code: trimmedCode,
        payment_method: selectedPayment,
        items: checkoutItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
        })),
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
      Alert.alert("Success", nextQuote.coupon?.message || "Coupon applied");
    } catch (error) {
      const message = getErrorMessage(error, "Unable to apply coupon");
      setAppliedCoupon(null);
      setAppliedCouponCode(null);
      setCouponError(message);

      try {
        const fallbackQuote = await orderService.quoteOrder({
          address_id: selectedAddress,
          payment_method: selectedPayment,
          items: checkoutItems.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
            price: item.product.price,
          })),
        });
        setQuote(fallbackQuote);
        setQuoteError("");
      } catch (fallbackError) {
        setQuote(null);
        setQuoteError(
          getErrorMessage(fallbackError, "Failed to calculate order summary"),
        );
      }
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleApplyCoupon = async () => {
    await applyCouponCode(couponCode);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setAppliedCouponCode(null);
    setCouponCode("");
    setCouponError("");
  };

  const openCouponModal = () => {
    setCouponModalVisible(true);
  };

  const selectCoupon = (coupon: Coupon) => {
    setCouponModalVisible(false);
    void applyCouponCode(coupon.code, coupon);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/cart");
  };

  const handleOpenAddressManager = () => {
    router.replace({
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
      },
    });
  };

  const handlePlaceOrder = async () => {
    if (!user?.id) {
      Alert.alert(
        "Authentication Required",
        "Please log in to place an order",
        [
          { text: "Cancel" },
          { text: "Login", onPress: () => router.push("/login") },
        ],
      );
      return;
    }

    if (!selectedAddress) {
      Alert.alert("Missing address", "Please select a shipping address.");
      return;
    }

    if (checkoutItems.length === 0) {
      Alert.alert("Empty Cart", "Add products before placing an order.");
      return;
    }

    if (!quote) {
      Alert.alert(
        "Pricing unavailable",
        "Please wait for the order summary to finish calculating.",
      );
      return;
    }

    try {
      setSubmitting(true);
      const order = await orderService.createOrder({
        address_id: selectedAddress,
        coupon_code: appliedCouponCode ?? undefined,
        payment_method: selectedPayment,
        items: checkoutItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
        })),
      });

      if (!isDirectCheckout && selectedProductIds.size > 0) {
        checkoutItems.forEach((item) => removeFromCart(item.product.id));
      } else if (!isDirectCheckout) {
        clearCart();
      }
      Alert.alert(
        "Success",
        `Order ${order.order_no || `#${order.id}`} placed successfully.`,
        [{ text: "Continue", onPress: () => router.push("/") }],
      );
    } catch (error) {
      Alert.alert("Error", getErrorMessage(error, "Failed to place order"));
    } finally {
      setSubmitting(false);
    }
  };

  const summaryRows = [
    {
      label: "Subtotal",
      value: formatCurrency(quote?.subtotal ?? cartSubtotal),
    },
    {
      label: "Tax",
      value: quote
        ? formatCurrency(quote.tax)
        : quoteLoading
          ? "Calculating..."
          : "--",
    },
    {
      label: "Shipping",
      value: quote
        ? formatCurrency(quote.shipping_fee)
        : quoteLoading
          ? "Calculating..."
          : "--",
    },
    ...(quote && quote.discount > 0
      ? [{ label: "Discount", value: `-${quote.discount.toFixed(2)}` }]
      : []),
  ];

  const placeOrderDisabled =
    invalidSelectionHandled || submitting || quoteLoading;

  const placeOrderHint = useMemo(() => {
    if (invalidSelectionHandled) {
      return "Checkout selection is invalid. Please return to cart and select items again.";
    }
    if (submitting) {
      return "Placing your order...";
    }
    if (quoteLoading) {
      return "Calculating latest total...";
    }
    if (checkoutItems.length === 0) {
      return "No items available for checkout.";
    }
    if (!selectedAddress) {
      return "Please select a shipping address.";
    }
    if (!quote) {
      return "Waiting for order summary. Please try again in a moment.";
    }
    return "";
  }, [
    checkoutItems.length,
    invalidSelectionHandled,
    quote,
    quoteLoading,
    selectedAddress,
    submitting,
  ]);

  const placeOrderHintTone = useMemo(() => {
    if (!placeOrderHint) {
      return null;
    }
    if (invalidSelectionHandled || checkoutItems.length === 0) {
      return "error";
    }
    if (submitting || quoteLoading) {
      return "loading";
    }
    if (!selectedAddress || !quote) {
      return "warning";
    }
    return "neutral";
  }, [
    checkoutItems.length,
    invalidSelectionHandled,
    placeOrderHint,
    quote,
    quoteLoading,
    selectedAddress,
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
        <TouchableOpacity onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={s.title}>Order</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={s.content}>
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Address</Text>
            <TouchableOpacity
              style={s.addBtn}
              onPress={handleOpenAddressManager}
            >
              <Ionicons name="swap-horizontal" size={14} color="white" />
            </TouchableOpacity>
          </View>

          {!activeAddress ? (
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={handleOpenAddressManager}
            >
              <Text style={s.emptyBtnText}>Manage Address</Text>
            </TouchableOpacity>
          ) : (
            <View style={[s.addressItem, s.addressItemSelected]}>
              <View style={s.addressMainRow}>
                <View style={s.radio}>
                  <View style={s.radioDot} />
                </View>
                <View style={s.flex1}>
                  <View style={s.addressTitleRow}>
                    <Text style={s.bold12}>{activeAddress.full_name}</Text>
                    {activeAddress.is_default ? (
                      <View style={s.defaultBadge}>
                        <Text style={s.defaultBadgeText}>Default</Text>
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
                <Text style={s.addressManageButtonText}>Manage addresses</Text>
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
          <Text style={s.sectionTitle}>Items</Text>
          {missingSelectedCount > 0 ? (
            <Text style={s.warningText}>
              {missingSelectedCount} selected item(s) are no longer in cart and
              were removed from this checkout.
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
                <View style={s.quantityControl}>
                  <Ionicons name="layers-outline" size={16} color="#777" />
                  <Text style={s.quantity}>Qty: {item.quantity}</Text>
                </View>
              </View>
              <Text style={s.priceText}>
                {formatCurrency(item.product.price * item.quantity)}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Coupon</Text>
          {appliedCouponCode ? (
            <View style={s.appliedCoupon}>
              <View style={s.flex1}>
                <Text style={s.bold13}>{appliedCouponCode}</Text>
                <Text style={s.text11}>
                  {appliedCoupon?.description ||
                    "Coupon is applied via backend quote validation."}
                </Text>
              </View>
              <TouchableOpacity onPress={handleRemoveCoupon}>
                <Ionicons name="close" size={20} color="red" />
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <TouchableOpacity
                style={s.selectCouponBtn}
                onPress={openCouponModal}
              >
                <Text style={s.selectCouponBtnText}>Select Coupon</Text>
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={Colors.light.tint}
                />
              </TouchableOpacity>
              <TextInput
                style={s.input}
                placeholder="Or enter coupon code"
                value={couponCode}
                onChangeText={(text) => {
                  setCouponCode(text);
                  if (couponError) {
                    setCouponError("");
                  }
                }}
                autoCapitalize="characters"
              />
              {couponError ? (
                <Text style={s.errorText}>{couponError}</Text>
              ) : null}
              <TouchableOpacity
                style={s.applyBtn}
                onPress={handleApplyCoupon}
                disabled={quoteLoading}
              >
                <Text style={s.applyBtnText}>Apply Coupon</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Payment</Text>
          {PAYMENT_METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                s.paymentItem,
                selectedPayment === method.id && s.paymentItemSelected,
              ]}
              onPress={() => setSelectedPayment(method.id)}
            >
              <View style={s.radio}>
                {selectedPayment === method.id ? (
                  <View style={s.radioDot} />
                ) : null}
              </View>
              <Ionicons
                name={method.icon as never}
                size={20}
                color={
                  selectedPayment === method.id ? Colors.light.tint : "#999"
                }
              />
              <Text style={s.bold13}>{method.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.summaryBox}>
          <View style={s.summaryHeader}>
            <Text style={s.sectionTitle}>Summary</Text>
            {quoteLoading ? (
              <ActivityIndicator size="small" color={Colors.light.tint} />
            ) : null}
          </View>
          {quoteError ? <Text style={s.errorText}>{quoteError}</Text> : null}
          {summaryRows.map((row) => (
            <View key={row.label} style={s.summaryRow}>
              <Text style={s.text13}>{row.label}</Text>
              <Text style={s.text13}>{row.value}</Text>
            </View>
          ))}
          <View style={s.summaryRowTotal}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalAmount}>
              {quote
                ? formatCurrency(quote.total)
                : quoteLoading
                  ? "Calculating..."
                  : "--"}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.orderBtn, placeOrderDisabled && { opacity: 0.5 }]}
          disabled={placeOrderDisabled}
          onPress={handlePlaceOrder}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={s.orderBtnText}>Place Order</Text>
          )}
        </TouchableOpacity>
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
            <TouchableOpacity onPress={() => setCouponModalVisible(false)}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Select Coupon</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={s.modalContent}>
            {availableCoupons.length === 0 ? (
              <Text style={s.text13}>No available coupons</Text>
            ) : (
              availableCoupons.map((item) => (
                <TouchableOpacity
                  key={item.id.toString()}
                  style={s.couponItem}
                  onPress={() => selectCoupon(item)}
                >
                  <View style={s.flex1}>
                    <Text style={s.bold13}>{item.code}</Text>
                    <Text style={s.text11}>{item.description}</Text>
                    <Text style={s.text11}>
                      Min order: {formatCurrency(item.min_order_value ?? 0)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={Colors.light.tint}
                  />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    paddingVertical: 12,
    backgroundColor: Colors.light.tint,
  },
  title: { fontSize: 18, fontWeight: "bold", color: "white" },
  content: { flex: 1, padding: 12 },
  section: {
    marginBottom: 16,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
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
    backgroundColor: Colors.light.tint,
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyBtn: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  emptyBtnText: { color: "white", fontWeight: "600" },
  addressItem: {
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  addressMainRow: { flexDirection: "row", alignItems: "center" },
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
  addressItemSelected: { borderColor: Colors.light.tint },
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
  productImage: { width: 60, height: 60, borderRadius: 6, marginRight: 10 },
  quantityControl: { flexDirection: "row", alignItems: "center", gap: 8 },
  quantity: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 20,
    textAlign: "center",
  },
  warningText: { fontSize: 12, color: "#b45309", marginBottom: 8 },
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
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  summaryRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    backgroundColor: Colors.light.tint,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    marginTop: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  totalLabel: { fontSize: 14, fontWeight: "bold", color: "white" },
  totalAmount: { fontSize: 16, fontWeight: "bold", color: "white" },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: "#e0e0e0" },
  orderBtn: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  orderBtnText: { color: "white", fontSize: 15, fontWeight: "bold" },
  placeOrderHint: {
    marginTop: 8,
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.tint,
  },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "white" },
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
  flex1: { flex: 1 },
  text11: { fontSize: 11, color: "#666" },
  text13: { fontSize: 13 },
  bold12: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  bold13: { fontSize: 13, fontWeight: "600", marginLeft: 8 },
  priceText: { fontSize: 13, fontWeight: "bold", color: Colors.light.tint },
});
