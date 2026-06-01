import ToastBanner from "@/components/ui/toast-banner";
import { Colors } from "@/constants/theme";
import { couponService } from "@/services/couponService";
import { Coupon } from "@/types/coupons";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type CouponStatus = {
  label: string;
  backgroundColor: string;
  color: string;
};

const formatDate = (value?: string) => {
  if (!value) {
    return "Không giới hạn";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Không giới hạn";
  }

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDiscount = (coupon: Coupon) => {
  if (coupon.discount_type === "percent") {
    return `Giảm ${coupon.discount_value}%${
      coupon.max_discount != null
        ? `, tối đa ${formatCurrencyVnd(coupon.max_discount)}`
        : ""
    }`;
  }

  return `Giảm ${formatCurrencyVnd(coupon.discount_value)}`;
};

const getCouponStatus = (coupon: Coupon): CouponStatus => {
  const now = Date.now();
  const startAt = coupon.start_date ? new Date(coupon.start_date).getTime() : 0;
  const endAt = coupon.end_date ? new Date(coupon.end_date).getTime() : 0;

  if (!coupon.active) {
    return {
      label: "Tạm dừng",
      backgroundColor: "#f8d7da",
      color: "#721c24",
    };
  }

  if (startAt && now < startAt) {
    return {
      label: "Sắp diễn ra",
      backgroundColor: "#d1ecf1",
      color: "#0c5460",
    };
  }

  if (endAt && now > endAt) {
    return {
      label: "Đã hết hạn",
      backgroundColor: "#f8d7da",
      color: "#721c24",
    };
  }

  if (
    coupon.usage_limit != null &&
    (coupon.used_count ?? 0) >= coupon.usage_limit
  ) {
    return {
      label: "Đã hết lượt",
      backgroundColor: "#fff3cd",
      color: "#856404",
    };
  }

  return {
    label: "Khả dụng",
    backgroundColor: "#d4edda",
    color: "#155724",
  };
};

const CouponCard = React.memo(function CouponCard({
  coupon,
}: {
  coupon: Coupon;
}) {
  const status = getCouponStatus(coupon);

  return (
    <View style={styles.couponCard}>
      <View style={styles.couponHeader}>
        <View style={styles.ticketIcon}>
          <Ionicons name="ticket" size={28} color={Colors.light.tint} />
        </View>
        <View style={styles.couponTitleArea}>
          <Text style={styles.couponCode} numberOfLines={1}>
            {coupon.code}
          </Text>
          <Text style={styles.couponDescription} numberOfLines={2}>
            {coupon.description || "Voucher ưu đãi dành cho đơn hàng hợp lệ."}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: status.backgroundColor },
          ]}
        >
          <Text style={[styles.statusText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>

      <View style={styles.ruleBox}>
        <Text style={styles.discountText}>{formatDiscount(coupon)}</Text>
        <Text style={styles.ruleText}>
          Đơn tối thiểu {formatCurrencyVnd(coupon.min_order_value ?? 0)}
        </Text>
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Bắt đầu</Text>
          <Text style={styles.metaValue}>{formatDate(coupon.start_date)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Kết thúc</Text>
          <Text style={styles.metaValue}>{formatDate(coupon.end_date)}</Text>
        </View>
      </View>
    </View>
  );
});

export default function CouponScreen() {
  const insets = useSafeAreaInsets();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);

  const loadCoupons = useCallback(async () => {
    try {
      const data = await couponService.getCoupons();
      setCoupons(data);
    } catch (error) {
      void error;
      setToast({
        message: "Không thể tải danh sách voucher. Vui lòng thử lại.",
        type: "error",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const filteredCoupons = useMemo(() => {
    const keyword = submittedSearch.trim().toLowerCase();
    if (!keyword) {
      return coupons;
    }

    return coupons.filter((coupon) => {
      const description = coupon.description ?? "";
      return (
        coupon.code.toLowerCase().includes(keyword) ||
        description.toLowerCase().includes(keyword)
      );
    });
  }, [coupons, submittedSearch]);

  const activeCount = useMemo(
    () => coupons.filter((coupon) => getCouponStatus(coupon).label === "Khả dụng")
      .length,
    [coupons],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadCoupons();
  }, [loadCoupons]);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    setSubmittedSearch(text);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Kho voucher</Text>
          <View style={styles.headerSide} />
        </View>
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
        <Text style={styles.title}>Kho voucher</Text>
        <View style={styles.headerSide} />
      </View>

      <ToastBanner
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />

      <FlatList
        style={styles.content}
        contentContainerStyle={{
          paddingBottom: 12 + Math.max(insets.bottom, 8),
        }}
        data={filteredCoupons}
        keyExtractor={(coupon) => coupon.id.toString()}
        renderItem={({ item }) => <CouponCard coupon={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.light.tint}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.summaryCard}>
              <View>
                <Text style={styles.summaryLabel}>Ưu đãi mỗi tháng</Text>
                <Text style={styles.summaryTitle}>Hơn 50 mã ưu đãi</Text>
                <Text style={styles.summaryText}>
                  {activeCount} voucher đang khả dụng trong hệ thống.
                </Text>
              </View>
              <View style={styles.summaryIcon}>
                <Ionicons name="gift" size={30} color="#fff" />
              </View>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                value={searchText}
                onChangeText={handleSearch}
                placeholder="Nhập mã hoặc mô tả voucher"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                returnKeyType="search"
              />
              {searchText ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchText("");
                    setSubmittedSearch("");
                  }}
                >
                  <Ionicons name="close-circle" size={20} color="#bbb" />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.listTitleRow}>
              <Text style={styles.listTitle}>Tất cả voucher</Text>
              <Text style={styles.listCount}>{filteredCoupons.length} mã</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="ticket-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Không tìm thấy voucher phù hợp.</Text>
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
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: "#fff",
  },
  summaryIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  searchBox: {
    minHeight: 46,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eee",
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    color: "#333",
    fontSize: 14,
  },
  listTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  listCount: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  couponCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
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
  couponHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  ticketIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  couponTitleArea: {
    flex: 1,
    minWidth: 0,
  },
  couponCode: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  couponDescription: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  ruleBox: {
    backgroundColor: "#fff7f5",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  discountText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.tint,
    marginBottom: 4,
  },
  ruleText: {
    fontSize: 13,
    color: "#666",
  },
  metaGrid: {
    flexDirection: "row",
    gap: 8,
  },
  metaItem: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 10,
  },
  metaLabel: {
    fontSize: 11,
    color: "#999",
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
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
});