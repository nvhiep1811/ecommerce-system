import { getOrderStatusLabel, formatOrderDate } from "@/constants/order-status";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { orderService } from "@/services/orderService";
import { Order, OrderItem } from "@/types/order";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface OrderWithDetails extends Order {
  items: OrderItem[];
}

const getItems = (order: OrderWithDetails) => order.items ?? [];

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/profile");
  };

  useEffect(() => {
    if (orderId) {
      void loadOrderDetails(Number(orderId));
    }
  }, [orderId]);

  const loadOrderDetails = async (id: number) => {
    try {
      const orderData = await orderService.refreshOrderById(id);
      setOrder(orderData as OrderWithDetails);
    } catch (error) {
      void error;
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
      case "pending_payment":
        return "#fff3cd";
      case "paid":
        return "#d4edda";
      case "payment_expired":
        return "#f8d7da";
      case "confirmed":
        return "#d1ecf1";
      case "shipped":
      case "delivered":
        return "#d4edda";
      case "cancelled":
        return "#f8d7da";
      default:
        return "#f8f9fa";
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case "pending":
      case "pending_payment":
        return "#856404";
      case "paid":
        return "#155724";
      case "payment_expired":
        return "#721c24";
      case "confirmed":
        return "#0c5460";
      case "shipped":
      case "delivered":
        return "#155724";
      case "cancelled":
        return "#721c24";
      default:
        return "#6c757d";
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.title}>Chi tiết đơn hàng</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Không tìm thấy đơn hàng.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canContinuePayment =
    user?.id === order.user_id &&
    (order.next_action === "SHOW_QR" ||
      order.next_action === "OPEN_CHECKOUT_URL");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Chi tiết đơn hàng</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderId}>
              {order.order_no || `Đơn #${order.id}`}
            </Text>
            <Text style={styles.orderDate}>
              {formatOrderDate(order.created_at)}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(order.status) },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: getStatusTextColor(order.status) },
              ]}
            >
              {getOrderStatusLabel(order.status)}
            </Text>
          </View>
        </View>

        {order.address && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
            <View style={styles.addressCard}>
              <Text style={styles.addressName}>{order.address.full_name}</Text>
              <Text style={styles.addressText}>{order.address.phone}</Text>
              <Text style={styles.addressText}>
                {order.address.address_line}
              </Text>
              <Text style={styles.addressText}>
                {order.address.city}, {order.address.province}
              </Text>
              <Text style={styles.addressText}>
                {order.address.postal_code}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thanh toán</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.summaryLabel}>Phương thức</Text>
            <Text style={styles.summaryValue}>
              {order.payment_method ?? "COD"}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.summaryLabel}>Trạng thái</Text>
            <Text style={styles.summaryValue}>
              {order.payment_status ?? "unpaid"}
            </Text>
          </View>
          {canContinuePayment ? (
            <TouchableOpacity
              style={styles.paymentButton}
              onPress={() =>
                router.navigate({
                  pathname: "/orders/payment",
                  params: {
                    orderId: String(order.id),
                    source: "order_detail",
                  },
                })
              }
            >
              <Ionicons name="card-outline" size={18} color="white" />
              <Text style={styles.paymentButtonText}>Tiếp tục thanh toán</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Sản phẩm ({getItems(order).length})
          </Text>
          {getItems(order).map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <Image
                source={
                  item.products?.thumbnail
                    ? { uri: item.products.thumbnail }
                    : undefined
                }
                style={styles.itemImage}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.products?.name || "Sản phẩm không xác định"}
                </Text>
                <Text style={styles.itemQuantity}>
                  Số lượng: {item.quantity}
                </Text>
                <Text style={styles.itemPrice}>
                  {formatCurrencyVnd(Number(item.price ?? 0))} / sản phẩm
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                {formatCurrencyVnd(
                  Number(item.price ?? 0) * Number(item.quantity ?? 0),
                )}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tổng đơn hàng</Text>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tạm tính</Text>
              <Text style={styles.summaryValue}>
                {formatCurrencyVnd(order.subtotal)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Thuế</Text>
              <Text style={styles.summaryValue}>
                {formatCurrencyVnd(order.tax)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phí giao hàng</Text>
              <Text style={styles.summaryValue}>
                {formatCurrencyVnd(order.shipping_fee)}
              </Text>
            </View>
            {order.discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Giảm giá</Text>
                <Text style={[styles.summaryValue, styles.discountText]}>
                  -{formatCurrencyVnd(order.discount)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Tổng cộng</Text>
              <Text style={styles.totalAmount}>
                {formatCurrencyVnd(order.total)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
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
  headerButton: {
    width: 40,
    height: 40,
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
  },
  content: {
    flex: 1,
    padding: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  section: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderId: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  orderDate: {
    fontSize: 14,
    color: "#666",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  addressCard: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 6,
  },
  addressName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    color: "#333",
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.light.tint,
  },
  summaryBox: {
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
    padding: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  paymentButton: {
    marginTop: 12,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  paymentButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  discountText: {
    color: "#28a745",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#dee2e6",
    paddingTop: 12,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.tint,
  },
});
