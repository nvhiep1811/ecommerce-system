import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardCard } from "@/components/seller/DashboardCard";
import {
  sellerService,
  TimeRange,
  PeriodMetrics,
  GeneralMetrics,
} from "@/services/sellerService";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import ToastBanner from "@/components/ui/toast-banner";
import {
  goToProfile,
  goToSellerOrders,
  goToSellerProducts,
  openSellerEditProduct,
  PROFILE_ROUTE,
  useSellerHardwareBack,
} from "@/utils/sellerNavigation";

export default function SellerDashboardScreen() {
  const { profile, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  useSellerHardwareBack(PROFILE_ROUTE);

  // State quản lý thống kê
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [periodMetrics, setPeriodMetrics] = useState<PeriodMetrics | null>(null);
  const [generalMetrics, setGeneralMetrics] = useState<GeneralMetrics | null>(null);

  const [products, setProducts] = useState<any[]>([]);
  const [, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);
  const previousTimeRangeRef = useRef(timeRange);

  const loadDashboardData = useCallback(async () => {
    if (authLoading || !profile || profile.role !== "seller") {
      return;
    }

    try {
      const data = await sellerService.fetchSellerDashboardData(profile.id, timeRange);
      setPeriodMetrics(data.periodMetrics);
      setGeneralMetrics(data.generalMetrics);
      setProducts(data.products);
      setOrders(data.orders);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể tải dữ liệu";
      setToast({ message, type: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authLoading, profile, timeRange]);

  // Load khi focus màn hình
  useFocusEffect(
    useCallback(() => {
      if (authLoading) {
        return;
      }

      if (!profile || profile.role !== "seller") {
        setToast({
          message: "Bạn không có quyền truy cập trang này",
          type: "error",
        });
        goToProfile();
        return;
      }

      loadDashboardData();
    }, [authLoading, profile, loadDashboardData]),
  );

  // Reload data khi thay đổi bộ lọc thời gian
  useEffect(() => {
    if (previousTimeRangeRef.current === timeRange) {
      return;
    }

    previousTimeRangeRef.current = timeRange;
    if (!authLoading && !loading) {
      setLoading(true);
      void loadDashboardData();
    }
  }, [authLoading, loadDashboardData, loading, timeRange]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const lowStockProducts = products
    ? sellerService.getLowStockProducts(products, 5)
    : [];

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.headerWrapper}>
          <View style={styles.headerTop}>
            <View style={styles.welcomeInfo}>
              <Text style={styles.welcomeTextSmall}>Đang tải...</Text>
              <Text style={styles.welcomeName}>Bảng điều khiển</Text>
            </View>
          </View>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.headerWrapper}>
        <View style={styles.headerTop}>
          <View style={styles.welcomeInfo}>
            <Text style={styles.welcomeTextSmall}>Xin chào,</Text>
            <Text style={styles.welcomeName}>
              {profile?.full_name || "Người bán"}
            </Text>
            <Text style={styles.welcomeSubtext}>
              Đây là tổng quan kinh doanh của bạn
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => router.push("/chat" as any)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={23} color={Colors.light.tint} />
            </TouchableOpacity>
            <TouchableOpacity onPress={goToProfile}>
              <Image
                source={{
                  uri: profile?.avatar_url || "https://via.placeholder.com/80",
                }}
                style={styles.avatar}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bộ lọc thời gian (Cố định) */}
      <View style={styles.timeFilterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeFilterContainer}
        >
          {[
            { id: "today", label: "Hôm nay" },
            { id: "yesterday", label: "Hôm qua" },
            { id: "last7days", label: "7 ngày qua" },
            { id: "last30days", label: "30 ngày qua" },
            { id: "thisMonth", label: "Tháng này" },
            { id: "thisYear", label: "Năm nay" },
            { id: "allTime", label: "Toàn thời gian" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.timeFilterTab,
                timeRange === tab.id && styles.timeFilterTabActive,
              ]}
              onPress={() => setTimeRange(tab.id as TimeRange)}
            >
              <Text
                style={[
                  styles.timeFilterText,
                  timeRange === tab.id && styles.timeFilterTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.light.tint}
          />
        }
        contentContainerStyle={{
          paddingBottom: 24 + Math.max(insets.bottom, 8),
        }}
      >
        {/* Phân tích bán hàng */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phân tích bán hàng</Text>
          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsLabel}>Doanh thu</Text>
              <Text style={styles.analyticsValue}>
                {sellerService.formatCurrency(periodMetrics?.revenue ?? 0)}
              </Text>
              {periodMetrics?.revenueTrend !== undefined && (
                <Text
                  style={[
                    styles.trendText,
                    periodMetrics.revenueTrend >= 0 ? styles.trendUp : styles.trendDown,
                  ]}
                >
                  {periodMetrics.revenueTrend >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(periodMetrics.revenueTrend)}% so với kỳ trước
                </Text>
              )}
            </View>

            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsLabel}>Đơn hàng</Text>
              <Text style={styles.analyticsValue}>
                {periodMetrics?.ordersCount ?? 0}
              </Text>
              {periodMetrics?.ordersTrend !== undefined && (
                <Text
                  style={[
                    styles.trendText,
                    periodMetrics.ordersTrend >= 0 ? styles.trendUp : styles.trendDown,
                  ]}
                >
                  {periodMetrics.ordersTrend >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(periodMetrics.ordersTrend)}%
                </Text>
              )}
            </View>

            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsLabel}>Số lượng sản phẩm đã bán</Text>
              <Text style={styles.analyticsValue}>
                {periodMetrics?.salesCount ?? 0}
              </Text>
            </View>
          </View>
        </View>

        {/* Vận hành & Hiệu suất */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hiệu suất & Vận hành</Text>
          
          <DashboardCard
            icon="checkmark-circle"
            label="Đơn hàng chờ xử lý"
            value={generalMetrics?.pendingOrdersCount ?? 0}
            unit="đơn"
            onPress={goToSellerOrders}
          />

          <View style={styles.statsRow}>
            <View style={{ flex: 1 }}>
              <DashboardCard
                icon="cube"
                label="Đang bán"
                value={generalMetrics?.activeProducts ?? 0}
                unit={`/${generalMetrics?.totalProducts ?? 0}`}
                onPress={goToSellerProducts}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DashboardCard
                icon="warning"
                label="Hết hàng"
                value={generalMetrics?.outOfStockProducts ?? 0}
                onPress={goToSellerProducts}
              />
            </View>
          </View>
        </View>

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>⚠️ Cảnh báo tồn kho</Text>
              <TouchableOpacity
                onPress={goToSellerProducts}
              >
                <Text style={styles.viewAllLink}>Xem tất cả</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.alertCard}>
              <Ionicons name="warning" size={20} color="#f59e0b" />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>
                  {lowStockProducts.length} sản phẩm sắp hết hàng
                </Text>
                <Text style={styles.alertText}>
                  Tồn kho dưới 5 cái - hãy bổ sung thêm
                </Text>
              </View>
            </View>

            {lowStockProducts.slice(0, 3).map((product) => (
              <View key={product.id} style={styles.lowStockItem}>
                <View style={styles.lowStockItemInfo}>
                  <Text style={styles.lowStockItemName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.lowStockItemStock}>
                    Tồn kho: {product.stock} cái
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => openSellerEditProduct(product.id)}
                  style={styles.editButton}
                >
                  <Ionicons name="create-outline" size={18} color="#1f2937" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

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
    paddingBottom: 20,
    paddingTop: 10,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  welcomeInfo: {
    flex: 1,
  },
  welcomeTextSmall: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
  },
  welcomeName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    marginVertical: 2,
  },
  welcomeSubtext: {
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#fff",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.65)",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  timeFilterWrapper: {
    backgroundColor: "white",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    zIndex: 5,
  },
  timeFilterContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
  },
  timeFilterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  timeFilterTabActive: {
    backgroundColor: Colors.light.tint,
  },
  timeFilterText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6b7280",
  },
  timeFilterTextActive: {
    color: "white",
    fontWeight: "600",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  analyticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  analyticsCard: {
    width: "48%", // Chia 2 cột
    backgroundColor: "white",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  analyticsLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
  },
  analyticsValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  trendText: {
    fontSize: 11,
    fontWeight: "500",
  },
  trendUp: {
    color: "#10b981", 
  },
  trendDown: {
    color: "#ef4444", 
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  viewAllLink: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  alertCard: {
    flexDirection: "row",
    backgroundColor: "#fffbeb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
    alignItems: "center",
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  alertText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  lowStockItem: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  lowStockItemInfo: {
    flex: 1,
  },
  lowStockItemName: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1f2937",
  },
  lowStockItemStock: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
    fontWeight: "600",
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
});
