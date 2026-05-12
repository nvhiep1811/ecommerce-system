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
import { useFocusEffect, router } from "expo-router";
import React, { useCallback, useState, useEffect } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import ToastBanner from "@/components/ui/toast-banner";

export default function SellerDashboardScreen() {
  const { profile, isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();

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
        router.replace("/(tabs)/profile");
        return;
      }

      loadDashboardData();
    }, [authLoading, profile, loadDashboardData]),
  );

  // Reload data khi thay đổi bộ lọc thời gian
  useEffect(() => {
    if (!loading && !authLoading) {
      setLoading(true);
      loadDashboardData();
    }
  }, [timeRange]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const lowStockProducts = products
    ? sellerService.getLowStockProducts(products, 5)
    : [];

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
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
          <Text style={styles.headerTitle}>Bảng điều khiển</Text>
          <View style={styles.headerPlaceholder} />
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
        <Text style={styles.headerTitle}>Bảng điều khiển</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.headerButton}>
          <Ionicons name="refresh" size={24} color="white" />
        </TouchableOpacity>
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
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            Xin chào, {profile?.full_name || "Người bán"}
          </Text>
          <Text style={styles.welcomeSubtext}>
            Đây là tổng quan kinh doanh của bạn
          </Text>
        </View>

        {/* Bộ lọc thời gian */}
        <View style={styles.timeFilterContainer}>
          {[
            { id: "today", label: "Hôm nay" },
            { id: "yesterday", label: "Hôm qua" },
            { id: "week", label: "Tuần này" },
            { id: "month", label: "Tháng này" },
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
        </View>

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
              <Text style={styles.analyticsLabel}>Sản phẩm đã bán</Text>
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
            onPress={() => router.navigate("/seller/orders")}
          />

          <View style={styles.statsRow}>
            <View style={{ flex: 1 }}>
              <DashboardCard
                icon="cube"
                label="Đang bán"
                value={generalMetrics?.activeProducts ?? 0}
                unit={`/${generalMetrics?.totalProducts ?? 0}`}
                onPress={() => router.navigate("/seller/products")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DashboardCard
                icon="warning"
                label="Hết hàng"
                value={generalMetrics?.outOfStockProducts ?? 0}
                onPress={() => router.navigate("/seller/products")}
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
                onPress={() => router.navigate("/seller/products")}
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
                  onPress={() =>
                    router.navigate(`/seller/edit-product?id=${product.id}`)
                  }
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.tint,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerPlaceholder: {
    width: 40,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "white",
    textAlign: "center",
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
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: "#6b7280",
  },
  timeFilterContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  timeFilterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
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