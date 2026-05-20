import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { couponService } from "@/services/couponService"; 
import { Coupon } from "@/types/coupons"; 
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import ToastBanner from "@/components/ui/toast-banner";

export function SellerCouponsScreen() {
  const { profile, isLoading: authLoading } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [filteredCoupons, setFilteredCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [pendingDeleteCouponId, setPendingDeleteCouponId] = useState<
    number | null
  >(null);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);

  const loadCoupons = useCallback(async () => {
    try {
      const data = await couponService.getCoupons();
      const sortedData = data.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
      setCoupons(sortedData);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Không thể tải danh sách coupon",
        type: "error",
      });
    } finally {
      setLoading(false);
      setRefreshing(false); // Tắt loading của refresh
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;

      if (!profile || profile.role !== "seller") {
        setToast({
          message: "Bạn không có quyền truy cập trang này",
          type: "error",
        });
        router.replace("/(tabs)/profile");
        return;
      }

      void loadCoupons();
    }, [authLoading, profile, loadCoupons])
  );

  // Hàm xử lý kéo xuống để refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadCoupons();
  }, [loadCoupons]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCoupons(coupons);
    } else {
      const filtered = coupons.filter(
        (coupon) =>
          coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (coupon.description &&
            coupon.description
              .toLowerCase()
              .includes(searchQuery.toLowerCase())),
      );
      setFilteredCoupons(filtered);
    }
  }, [coupons, searchQuery]);

  const handleDeleteCoupon = (couponId: number) => {
    setPendingDeleteCouponId(couponId);
    setDeleteModalVisible(true);
  };

  const handleConfirmDeleteCoupon = async () => {
    if (pendingDeleteCouponId === null) {
      setDeleteModalVisible(false);
      return;
    }

    try {
      // Gọi API xóa coupon
      await couponService.deleteCoupon(pendingDeleteCouponId);
      setCoupons((prev) =>
        prev.filter((c) => c.id !== pendingDeleteCouponId),
      );
      setDeleteModalVisible(false);
      setPendingDeleteCouponId(null);
      setToast({ message: "Đã xóa coupon thành công", type: "success" });
    } catch {
      setToast({ message: "Không thể xóa coupon", type: "error" });
    }
  };

  const onEdit = React.useCallback((id: number) => {
    router.navigate(`/seller/edit-coupon?id=${id}` as any);
  }, []);

  const onDelete = React.useCallback((id: number) => {
    handleDeleteCoupon(id);
  }, []);

  const renderCouponItem = React.useCallback(
    ({ item }: { item: Coupon }) => {
      // Xác định chuỗi hiển thị mức giảm giá
      const discountDisplay =
        item.discount_type === "percent"
          ? `Giảm ${item.discount_value}%`
          : `Giảm ${formatCurrencyVnd(item.discount_value)}`;

      const isActive = item.active;

      return (
        <View style={[styles.voucherCard, !isActive && styles.voucherCardInactive]}>
          <View style={styles.voucherInfo}>
            <View style={styles.headerRow}>
              <Text style={styles.voucherCode} numberOfLines={1}>
                {item.code}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  isActive ? styles.statusActive : styles.statusInactive,
                ]}
              >
                <Text style={styles.statusText}>
                  {isActive ? "Đang hoạt động" : "Đã tắt"}
                </Text>
              </View>
            </View>

            <Text style={styles.voucherDiscount}>{discountDisplay}</Text>
            
            {item.description ? (
              <Text style={styles.voucherDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}

            <View style={styles.detailRow}>
              <Ionicons name="cart-outline" size={14} color="#666" />
              <Text style={styles.detailText}>
                Đơn tối thiểu: {formatCurrencyVnd(item.min_order_value)}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="pie-chart-outline" size={14} color="#666" />
              <Text style={styles.detailText}>
                Đã dùng: {item.used_count} {item.usage_limit ? `/ ${item.usage_limit}` : ""}
              </Text>
            </View>

            {item.endAt && (
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={14} color="#666" />
                <Text style={styles.detailText}>
                  HSD: {new Date(item.endAt).toLocaleDateString("vi-VN")}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.voucherActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => onEdit(item.id)}
            >
              <Ionicons name="create-outline" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => onDelete(item.id)}
            >
              <Ionicons name="trash-outline" size={20} color="red" />
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [onEdit, onDelete],
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
            style={styles.headerButton}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Quản lý Voucher</Text>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.navigate("/seller/add-coupon" as any)}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#666"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm mã coupon hoặc mô tả..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        style={styles.content}
        data={filteredCoupons}
        renderItem={renderCouponItem}
        keyExtractor={(item) => item.id.toString()}
        initialNumToRender={8}
        windowSize={5}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.light.tint}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="ticket-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery.trim()
                ? "Không tìm thấy coupon nào"
                : "Chưa có coupon nào"}
            </Text>
            {!searchQuery.trim() && (
              <TouchableOpacity
                style={styles.addFirstButton}
                onPress={() => router.navigate("/seller/add-coupon" as any)}
              >
                <Text style={styles.addFirstButtonText}>
                  Tạo coupon đầu tiên
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <ConfirmActionModal
        visible={deleteModalVisible}
        title="Xóa Coupon"
        message="Bạn có chắc chắn muốn xóa mã coupon này? Hành động này không thể hoàn tác."
        confirmLabel="Xóa"
        destructive
        onConfirm={() => {
          void handleConfirmDeleteCoupon();
        }}
        onCancel={() => {
          setDeleteModalVisible(false);
          setPendingDeleteCouponId(null);
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

export default SellerCouponsScreen;

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
  headerTitle: {
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
  voucherCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.tint,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }),
  },
  voucherCardInactive: {
    opacity: 0.6,
    borderLeftColor: "#999",
  },
  voucherInfo: {
    flex: 1,
    marginRight: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  voucherCode: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: "#dcfce7",
  },
  statusInactive: {
    backgroundColor: "#f1f5f9",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#475569",
  },
  voucherDiscount: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.tint,
    marginBottom: 4,
  },
  voucherDesc: {
    fontSize: 14,
    color: "#555",
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  detailText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 6,
  },
  voucherActions: {
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  editButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  deleteButton: {
    padding: 8,
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
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.1)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        }),
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
});
