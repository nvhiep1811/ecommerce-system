import {
  formatOrderDate,
  getOrderStatusLabel,
  isOrderWaitingSellerConfirmation,
  orderMatchesStatusGroup,
} from "@/constants/order-status";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { orderService } from "@/services/orderService";
import { Order, OrderItem } from "@/types/order";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ToastBanner from "@/components/ui/toast-banner";

interface OrderWithItems extends Order {
  items: OrderItem[];
}

type PendingOrderAction = "advance" | "cancel";

const STATUS_FILTERS = [
  "all",
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

const getItems = (order: OrderWithItems) => order.items ?? [];

export default function SellerOrdersScreen() {
  const { profile, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [pendingOrderAction, setPendingOrderAction] =
    useState<PendingOrderAction | null>(null);
  const [pendingOrderActionLabel, setPendingOrderActionLabel] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!profile || profile.role !== "seller") {
      setToast({
        message: "Bạn không có quyền truy cập trang này.",
        type: "error",
      });
      router.replace("/(tabs)/profile");
      return;
    }

    const loadOrders = async () => {
      try {
        const sellerOrders = await orderService.getAllOrdersBySeller(
          profile.id,
        );
        setOrders(sellerOrders as OrderWithItems[]);
      } catch (error) {
        void error;
        setToast({
          message: "Không thể tải danh sách đơn hàng.",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadOrders();
  }, [authLoading, profile]);

  const requestOrderAction = useCallback(
    (orderId: number, action: PendingOrderAction, label: string) => {
      setPendingOrderId(orderId);
      setPendingOrderAction(action);
      setPendingOrderActionLabel(label);
      setStatusModalVisible(true);
    },
    [],
  );

  const handleUpdateOrderStatus = async () => {
    if (pendingOrderId === null || !pendingOrderAction) {
      setStatusModalVisible(false);
      return;
    }

    try {
      setUpdatingStatus(true);
      const updatedOrder =
        pendingOrderAction === "cancel"
          ? await orderService.cancelOrder(pendingOrderId)
          : await orderService.advanceOrder(pendingOrderId);
      setOrders((prev) =>
        prev.map((order) =>
          order.id === pendingOrderId
            ? (updatedOrder as OrderWithItems)
            : order,
        ),
      );
      setStatusModalVisible(false);
      setPendingOrderId(null);
      setPendingOrderAction(null);
      setPendingOrderActionLabel("");
      setToast({
        message:
          pendingOrderAction === "cancel"
            ? "Đã hủy đơn hàng."
            : "Đã chuyển đơn hàng sang bước tiếp theo.",
        type: "success",
      });
    } catch (error) {
      void error;
      setToast({
        message: "Không thể cập nhật trạng thái đơn hàng.",
        type: "error",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getNextActionLabel = useCallback((status: string) => {
    if (isOrderWaitingSellerConfirmation(status)) {
      return "Xác nhận";
    }
    switch (status) {
      case "confirmed":
      case "processing":
        return "Giao hàng";
      case "shipping":
      case "shipped":
        return "Đã giao";
      default:
        return null;
    }
  }, []);

  const canCancelOrder = useCallback((order: OrderWithItems) => {
    const status = String(order.status ?? "").toLowerCase();
    const paymentStatus = String(order.payment_status ?? "").toLowerCase();
    const paymentMethod = String(order.payment_method ?? "").toUpperCase();
    if (
      !["pending", "pending_payment", "confirmed", "processing"].includes(
        status,
      )
    ) {
      return false;
    }
    return !(paymentStatus === "paid" && paymentMethod !== "COD");
  }, []);

  const getStatusActions = useCallback(
    (order: OrderWithItems) => {
      const nextLabel = getNextActionLabel(order.status);
      const canCancel = canCancelOrder(order);
      if (!nextLabel && !canCancel) {
        return null;
      }

      return (
        <>
          {nextLabel ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => requestOrderAction(order.id, "advance", nextLabel)}
            >
              <Text style={styles.actionButtonText}>{nextLabel}</Text>
            </TouchableOpacity>
          ) : null}
          {canCancel ? (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => requestOrderAction(order.id, "cancel", "Hủy đơn")}
            >
              <Text style={styles.cancelButtonText}>Hủy đơn</Text>
            </TouchableOpacity>
          ) : null}
        </>
      );
    },
    [canCancelOrder, getNextActionLabel, requestOrderAction],
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
      case "paid":
        return "#fff3cd";
      case "confirmed":
        return "#d1ecf1";
      case "shipping":
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
      case "paid":
        return "#856404";
      case "confirmed":
        return "#0c5460";
      case "shipping":
      case "shipped":
      case "delivered":
        return "#155724";
      case "cancelled":
        return "#721c24";
      default:
        return "#6c757d";
    }
  };

  const visibleOrders =
    selectedStatus === "all"
      ? orders
      : orders.filter((order) =>
          orderMatchesStatusGroup(order.status, selectedStatus),
        );

  const renderOrderItem = useCallback(
    ({ item: order }: { item: OrderWithItems }) => (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderIdentity}>
            <Text style={styles.orderId} numberOfLines={2}>
              {order.order_no || `Đơn #${order.id}`}
            </Text>
            <View style={styles.orderDateRow}>
              <Ionicons name="calendar-outline" size={14} color="#6b7280" />
              <Text style={styles.orderDate} numberOfLines={1}>
                {formatOrderDate(order.created_at)}
              </Text>
            </View>
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

        <View style={styles.itemsList}>
          {getItems(order)
            .slice(0, 2)
            .map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Image
                  source={
                    item.products?.thumbnail
                      ? { uri: item.products.thumbnail }
                      : undefined
                  }
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
          {getItems(order).length > 2 ? (
            <Text style={styles.moreItems}>
              +{getItems(order).length - 2} sản phẩm khác
            </Text>
          ) : null}
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.totalLabel}>Tổng:</Text>
          <Text style={styles.totalAmount}>
            {formatCurrencyVnd(order.total)}
          </Text>
        </View>

        <View style={styles.actionsContainer}>
          {getStatusActions(order)}
          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={() =>
              router.navigate(`/orders/detail?orderId=${order.id}`)
            }
          >
            <Text style={styles.viewDetailsText}>Xem chi tiết</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [getStatusActions],
  );

  if (authLoading || loading) {
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
      <View style={styles.headerWrapper}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Quản lý đơn hàng</Text>
            <Text style={styles.headerSubtitle}>
              Theo dõi và xử lý đơn hàng của bạn
            </Text>
          </View>
          <Ionicons
            name="receipt-outline"
            size={36}
            color="white"
            style={{ opacity: 0.9 }}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
        contentContainerStyle={styles.filtersContent}
      >
        {STATUS_FILTERS.map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              selectedStatus === status && styles.filterChipActive,
            ]}
            onPress={() => setSelectedStatus(status)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedStatus === status && styles.filterChipTextActive,
              ]}
            >
              {getOrderStatusLabel(status)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        style={styles.content}
        contentContainerStyle={{
          paddingBottom: 12 + Math.max(insets.bottom, 8),
        }}
        data={visibleOrders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id.toString()}
        initialNumToRender={6}
        windowSize={5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Không có đơn hàng phù hợp.</Text>
          </View>
        }
      />

      <ConfirmActionModal
        visible={statusModalVisible}
        title={
          pendingOrderAction === "cancel" ? "Hủy đơn hàng" : "Cập nhật đơn hàng"
        }
        message={
          pendingOrderAction === "cancel"
            ? "Bạn có chắc muốn hủy đơn hàng này?"
            : pendingOrderActionLabel
              ? `Chuyển đơn hàng sang bước "${pendingOrderActionLabel}"?`
              : "Chuyển đơn hàng sang bước tiếp theo?"
        }
        confirmLabel={
          updatingStatus
            ? "Đang cập nhật..."
            : pendingOrderAction === "cancel"
              ? "Hủy đơn"
              : pendingOrderActionLabel || "Tiếp tục"
        }
        destructive={pendingOrderAction === "cancel"}
        loading={updatingStatus}
        onConfirm={() => {
          void handleUpdateOrderStatus();
        }}
        onCancel={() => {
          setStatusModalVisible(false);
          setPendingOrderId(null);
          setPendingOrderAction(null);
          setPendingOrderActionLabel("");
        }}
      />
      <ToastBanner
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  headerWrapper: {
    backgroundColor: Colors.light.tint,
    paddingBottom: 16,
    paddingTop: 10,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  filters: {
    maxHeight: 56,
    backgroundColor: "white",
  },
  filtersContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#d7d7d7",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#f8f8f8",
  },
  filterChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
  },
  filterChipTextActive: {
    color: "white",
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
  orderCard: {
    backgroundColor: "white",
    borderRadius: 10,
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
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  orderIdentity: {
    flex: 1,
    minWidth: 0,
  },
  orderId: {
    marginBottom: 6,
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  orderDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderDate: {
    flexShrink: 1,
    fontSize: 12,
    color: "#666",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    minHeight: 32,
    justifyContent: "center",
  },
  statusText: {
    fontSize: 13,
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
    marginBottom: 12,
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
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  actionButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#dc2626",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "600",
  },
  viewDetailsButton: {
    borderWidth: 1,
    borderColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  viewDetailsText: {
    color: Colors.light.tint,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: "#666",
    marginTop: 16,
  },
});
