import { getOrderStatusLabel, formatOrderDate } from "@/constants/order-status";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { orderService } from "@/services/orderService";
import { Order } from "@/types/order";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ToastBanner from "@/components/ui/toast-banner";

interface OrderWithItems extends Order {
  items: any[];
}

const getItems = (order: OrderWithItems) => order.items ?? [];
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

const SUPPORTED_STATUS = new Set([
  "pending",
  "pending_payment",
  "paid",
  "payment_expired",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
]);

const OrderCard = React.memo(function OrderCard({
  order,
  profileRole,
  onConfirmOrder,
}: {
  order: OrderWithItems;
  profileRole?: string | null;
  onConfirmOrder: (orderId: number) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => router.navigate(`/orders/detail?orderId=${order.id}`)}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>
          {order.order_no || `Đơn #${order.id}`}
        </Text>
        <Text style={styles.orderDate}>
          {formatOrderDate(order.created_at)}
        </Text>
      </View>

      <View style={styles.orderStatus}>
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

      <View style={styles.itemsList}>
        {getItems(order)
          .slice(0, 2)
          .map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <Image
                source={{ uri: item.products?.thumbnail }}
                style={styles.itemImage}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.products?.name || "Sản phẩm không xác định"}
                </Text>
                <Text style={styles.itemQuantity}>
                  Số lượng: {item.quantity}
                </Text>
              </View>
              <Text style={styles.itemPrice}>
                {formatCurrencyVnd(Number(item.price ?? 0))}
              </Text>
            </View>
          ))}
        {getItems(order).length > 2 && (
          <Text style={styles.moreItems}>
            +{getItems(order).length - 2} sản phẩm khác
          </Text>
        )}
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.totalLabel}>Tổng:</Text>
        <Text style={styles.totalAmount}>{formatCurrencyVnd(order.total)}</Text>
      </View>

      {profileRole === "seller" &&
        (order.status === "pending" || order.status === "paid") && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => onConfirmOrder(order.id)}
            >
              <Text style={styles.confirmButtonText}>Xác nhận đơn</Text>
            </TouchableOpacity>
          </View>
        )}
    </TouchableOpacity>
  );
});

export default function PendingOrdersScreen() {
  const { user, profile } = useAuth();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);
  const normalizedStatus =
    typeof status === "string" ? status.toLowerCase() : "pending";
  const selectedStatus = SUPPORTED_STATUS.has(normalizedStatus)
    ? normalizedStatus
    : "pending";

  useEffect(() => {
    const loadPendingOrders = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        if (profile?.role === "seller") {
          const sellerOrders =
            await orderService.getOrdersByStatus(selectedStatus);
          setOrders(sellerOrders as OrderWithItems[]);
        } else {
          const allOrders = await orderService.getOrdersByUser(user.id);
          setOrders(
            allOrders.filter(
              (order) => order.status === selectedStatus,
            ) as OrderWithItems[],
          );
        }
      } catch (error) {
        void error;
      } finally {
        setLoading(false);
      }
    };

    void loadPendingOrders();
  }, [profile?.role, selectedStatus, user?.id]);

  const resolveScreenTitle = () => {
    if (profile?.role === "seller") {
      return "Quản lý đơn hàng";
    }

    return getOrderStatusLabel(selectedStatus);
  };

  const handleConfirmOrder = useCallback(async (orderId: number) => {
    try {
      await orderService.updateOrder(orderId, { status: "confirmed" });
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: "confirmed" } : order,
        ),
      );
      setToast({ message: "Đã xác nhận đơn hàng.", type: "success" });
    } catch (error) {
      void error;
      setToast({ message: "Không thể xác nhận đơn hàng.", type: "error" });
    }
  }, []);

  const renderOrder = useCallback(
    ({ item: order }: { item: OrderWithItems }) => (
      <OrderCard
        order={order}
        profileRole={profile?.role}
        onConfirmOrder={handleConfirmOrder}
      />
    ),
    [handleConfirmOrder, profile?.role],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }

              router.replace("/(tabs)/profile");
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>{resolveScreenTitle()}</Text>
        <View style={styles.headerSide} />
      </View>

      <ToastBanner
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />

      <FlatList
        style={styles.content}
        data={orders}
        keyExtractor={(order) => order.id.toString()}
        renderItem={renderOrder}
        initialNumToRender={6}
        windowSize={5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              Không có đơn hàng ở trạng thái này.
            </Text>
          </View>
        }
      />
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
  backButton: {
    width: 40,
    height: 40,
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "bold",
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
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
    textAlign: "center",
  },
  orderCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }),
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  orderDate: {
    fontSize: 12,
    color: "#666",
  },
  orderStatus: {
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: "#fff3cd",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 12,
    color: "#856404",
    fontWeight: "600",
  },
  itemsList: {
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    color: "#333",
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
    color: "#666",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.tint,
  },
  moreItems: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  totalLabel: {
    fontSize: 14,
    color: "#666",
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.light.tint,
  },
  actionsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  confirmButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});
