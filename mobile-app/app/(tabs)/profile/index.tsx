import { Colors } from "@/constants/theme";
import { isOrderWaitingSellerConfirmation } from "@/constants/order-status";
import { useAuth } from "@/contexts/AuthContext";
import { orderService } from "@/services/orderService";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ToastBanner from "@/components/ui/toast-banner";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface MenuItemProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  badge?: number | string;
}

interface QuickActionProps {
  icon: IconName;
  title: string;
  onPress?: () => void;
  badge?: number;
}

const MenuItem = ({ icon, title, subtitle, onPress, badge }: MenuItemProps) => (
  <TouchableOpacity style={menuStyles.menuItem} onPress={onPress}>
    <View style={menuStyles.menuIcon}>
      <Ionicons name={icon} size={22} color="#ee4d2d" />
    </View>
    <View style={menuStyles.menuContent}>
      <Text style={menuStyles.menuTitle}>{title}</Text>
      {subtitle && <Text style={menuStyles.menuSubtitle}>{subtitle}</Text>}
    </View>
    {badge ? (
      <View style={menuStyles.badge}>
        <Text style={menuStyles.badgeText}>{badge}</Text>
      </View>
    ) : null}
    <Ionicons name="chevron-forward" size={18} color="#ccc" />
  </TouchableOpacity>
);

const QuickAction = ({ icon, title, onPress, badge }: QuickActionProps) => (
  <TouchableOpacity style={actionStyles.quickAction} onPress={onPress}>
    <View style={actionStyles.quickActionIcon}>
      <Ionicons name={icon} size={28} color="#ee4d2d" />
      {badge && badge > 0 ? (
        <View style={actionStyles.badge}>
          <Text style={actionStyles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
    <Text style={actionStyles.quickActionText}>{title}</Text>
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const { user, profile, signOut, isLoading, uploadAvatar } = useAuth();
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [pendingPaymentOrdersCount, setPendingPaymentOrdersCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);
  const loadingOrderMetricsRef = useRef(false);

  const isPendingPaymentExpired = useCallback((order: any, nowTs: number) => {
    const status = String(order?.status ?? "").toLowerCase();
    if (status === "payment_expired") {
      return true;
    }

    const paymentStatus = String(order?.payment_status ?? "").toLowerCase();
    if (paymentStatus.includes("expire")) {
      return true;
    }

    const expiredAt = order?.payment?.expired_at;
    if (!expiredAt) {
      return false;
    }

    const expiredAtTs = Date.parse(expiredAt);
    if (Number.isNaN(expiredAtTs)) {
      return false;
    }

    return expiredAtTs <= nowTs;
  }, []);

  const loadOrderMetrics = useCallback(async () => {
    if (!user?.id || loadingOrderMetricsRef.current) {
      return;
    }

    loadingOrderMetricsRef.current = true;
    try {
      const orders = await orderService.getOrdersByUser(user.id);
      const nowTs = Date.now();

      let pendingCount = 0;
      let pendingPaymentCount = 0;

      for (const order of orders) {
        const status = String(order.status ?? "").toLowerCase();

        if (isOrderWaitingSellerConfirmation(status)) {
          pendingCount += 1;
        }

        if (
          status === "pending_payment" &&
          !isPendingPaymentExpired(order, nowTs)
        ) {
          pendingPaymentCount += 1;
        }
      }

      setPendingOrdersCount(pendingCount);
      setPendingPaymentOrdersCount(pendingPaymentCount);
    } catch (error) {
      void error;
    } finally {
      loadingOrderMetricsRef.current = false;
    }
  }, [isPendingPaymentExpired, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        setPendingOrdersCount(0);
        setPendingPaymentOrdersCount(0);
        return;
      }

      void loadOrderMetrics();

      const intervalId = setInterval(() => {
        void loadOrderMetrics();
      }, 15000);

      return () => {
        clearInterval(intervalId);
      };
    }, [loadOrderMetrics, user?.id]),
  );

  const navigateToOrderStatus = useCallback((status: string) => {
    router.navigate(`/orders/pending?status=${status}`);
  }, []);

  const navigateToOrderHistory = useCallback(() => {
    router.navigate("/orders/pending?status=all");
  }, []);

  const quickActions = useMemo(
    () => [
      {
        key: "pending_payment",
        icon: "qr-code-outline" as IconName,
        title: "Chờ thanh toán",
        badge: pendingPaymentOrdersCount,
        onPress: () => navigateToOrderStatus("pending_payment"),
      },
      {
        key: "pending",
        icon: "wallet-outline" as IconName,
        title: "Chờ xác nhận",
        badge: pendingOrdersCount,
        onPress: () => navigateToOrderStatus("pending"),
      },
      {
        key: "confirmed",
        icon: "cube-outline" as IconName,
        title: "Chờ lấy hàng",
        onPress: () => navigateToOrderStatus("confirmed"),
      },
      {
        key: "shipped",
        icon: "car-outline" as IconName,
        title: "Đang giao",
        onPress: () => navigateToOrderStatus("shipped"),
      },
      {
        key: "delivered",
        icon: "star-outline" as IconName,
        title: "Đánh giá",
        onPress: () => navigateToOrderStatus("delivered"),
      },
    ],
    [navigateToOrderStatus, pendingOrdersCount, pendingPaymentOrdersCount],
  );

  const handleSignOutConfirmed = async () => {
    try {
      setSigningOut(true);
      await signOut();
      router.replace("/(tabs)");
    } catch (error) {
      void error;
      setToast({
        message: "Không thể đăng xuất. Vui lòng thử lại.",
        type: "error",
      });
    } finally {
      setSigningOut(false);
      setSignOutModalVisible(false);
    }
  };

  const handleSignOut = () => {
    if (signingOut) {
      return;
    }

    setSignOutModalVisible(true);
  };

  const handleUploadAvatar = async () => {
    if (avatarUploading) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setToast({
        message: "Vui lòng cấp quyền truy cập thư viện ảnh để đổi avatar.",
        type: "error",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];
    setAvatarUploading(true);
    const { error } = await uploadAvatar({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    });
    setAvatarUploading(false);

    if (error) {
      setToast({ message: error, type: "error" });
      return;
    }

    setToast({ message: "Đã cập nhật ảnh đại diện.", type: "success" });
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="person-circle-outline" size={80} color="#ccc" />
        <Text style={styles.notLoggedText}>Đăng nhập để xem tài khoản</Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.navigate("/login")}
        >
          <Text style={styles.loginBtnText}>Đăng nhập</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => router.navigate("/(tabs)/cart")}
          >
            <Ionicons name="cart-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() =>
              router.navigate({
                pathname: "/chat" as any,
                params: { sellerName: "MegaMall Seller" },
              })
            }
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={24}
              color="#fff"
            />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri: profile?.avatar_url || "https://via.placeholder.com/80",
              }}
              style={styles.avatar}
            />
            <TouchableOpacity
              style={styles.editAvatarBtn}
              onPress={handleUploadAvatar}
              disabled={avatarUploading}
            >
              {avatarUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.profileInfo}
            onPress={() => router.navigate("/profile/edit")}
          >
            <Text style={styles.profileName} numberOfLines={1}>
              {profile?.full_name || user.email}
            </Text>
            <TouchableOpacity style={styles.memberBadge}>
              <Text style={styles.memberText}>Thành viên</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Người theo dõi</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>8</Text>
            <Text style={styles.statLabel}>Đang theo dõi</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.vipBanner}
      >
        <View style={styles.vipBadge}>
          <Text style={styles.vipText}>VIP</Text>
        </View>
        <Text style={styles.vipDescription}>
          Hơn 200 mã ưu đãi mỗi tháng, chỉ từ 29K!
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#ee4d2d" />
      </TouchableOpacity>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Đơn hàng của tôi</Text>
          <TouchableOpacity onPress={navigateToOrderHistory}>
            <Text style={styles.seeAll}>Xem lịch sử mua hàng</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={quickActions}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.orderActions}
          bounces={false}
          renderItem={({ item }) => (
            <QuickAction
              icon={item.icon}
              title={item.title}
              badge={item.badge}
              onPress={item.onPress}
            />
          )}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tiện ích của tôi</Text>
        <View style={styles.myUtilityGrid}>
          <View style={styles.utilityRow}>
            <TouchableOpacity style={styles.utilityCard}>
              <View style={styles.utilityCardIcon}>
                <Ionicons name="wallet" size={28} color="#ee4d2d" />
              </View>
              <Text style={styles.utilityCardTitle}>Ví MegaPay</Text>
              <Text style={styles.utilityCardSubtitle}>Kích hoạt ngay</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.utilityCard}>
              <View style={styles.utilityCardIcon}>
                <Ionicons name="card" size={28} color="#ee4d2d" />
              </View>
              <Text style={styles.utilityCardTitle}>MegaPay Later</Text>
              <Text style={styles.utilityCardSubtitle}>Mua trước, trả sau</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.utilityRow}>
            <TouchableOpacity style={styles.utilityCard}>
              <View style={styles.utilityCardIcon}>
                <Ionicons name="diamond" size={28} color="#ee4d2d" />
                <View style={styles.redDot} />
              </View>
              <Text style={styles.utilityCardTitle}>Điểm Mega</Text>
              <Text style={styles.utilityCardSubtitle}>Tích điểm mỗi ngày</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.utilityCard}
              onPress={() => router.navigate("/coupons" as any)}
            >
              <View style={styles.utilityCardIcon}>
                <Ionicons name="ticket" size={28} color="#ee4d2d" />
                <View style={styles.redDot} />
              </View>
              <Text style={styles.utilityCardTitle}>Kho voucher</Text>
              <Text style={styles.utilityCardSubtitle}>
                Hơn 50 voucher khả dụng
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {profile?.role === "seller" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kênh người bán</Text>
          <View style={{ gap: 5 }}>
            <MenuItem
              icon="cube"
              title="Sản phẩm của tôi"
              onPress={() => router.navigate("/seller/products" as any)}
            />
            <MenuItem
              icon="clipboard"
              title="Quản lý đơn hàng"
              onPress={() => router.navigate("/seller/orders" as any)}
            />
            <MenuItem icon="stats-chart" title="Phân tích bán hàng" />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tiện ích khác</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>Xem tất cả</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 5 }}>
          <MenuItem icon="people" title="Khách hàng thân thiết" />
          <MenuItem icon="bag-handle" title="Mua lại" />
          <MenuItem icon="trending-up" title="Trung tâm sáng tạo" />
          <MenuItem icon="wallet" title="Số dư Mega Mall" />
          <MenuItem icon="gift" title="Ưu đãi Mega Mall" />
          <MenuItem icon="heart" title="Yêu thích" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hỗ trợ</Text>
        <View style={{ gap: 5 }}>
          <MenuItem icon="help-circle-outline" title="Trung tâm trợ giúp" />
          <MenuItem icon="headset-outline" title="Chat với MegaMall" />
          <MenuItem icon="document-text-outline" title="Blog MegaMall" />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.signOutBtn, signingOut && styles.signOutBtnDisabled]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        <Ionicons name="log-out-outline" size={24} color="#ee4d2d" />
        <Text style={styles.signOutText}>
          {signingOut ? "Đang đăng xuất..." : "Đăng xuất"}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 30 }} />

      <ConfirmActionModal
        visible={signOutModalVisible}
        title="Đăng xuất"
        message="Bạn có chắc muốn đăng xuất?"
        confirmLabel={signingOut ? "Đang đăng xuất..." : "Đăng xuất"}
        destructive
        loading={signingOut}
        onConfirm={() => {
          void handleSignOutConfirmed();
        }}
        onCancel={() => setSignOutModalVisible(false)}
      />
      <ToastBanner
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
    </ScrollView>
  );
}

const menuStyles = StyleSheet.create({
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  menuIcon: {
    marginRight: 15,
    width: 30,
    alignItems: "center",
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  menuSubtitle: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  badge: {
    backgroundColor: "#ee4d2d",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
});

const actionStyles = StyleSheet.create({
  orderActions: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 12,
    paddingRight: 18,
  },
  quickAction: {
    alignItems: "center",
    width: 84,
    paddingVertical: 10,
    marginRight: 6,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff5f5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  quickActionText: {
    fontSize: 12,
    color: "#555",
    textAlign: "center",
    fontWeight: "500",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#ee4d2d",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
  },
  notLoggedText: {
    fontSize: 18,
    color: "#333",
    marginTop: 20,
    marginBottom: 30,
  },
  loginBtn: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 4,
  },
  loginBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    backgroundColor: Colors.light.tint,
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 15,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 15,
    marginBottom: 20,
  },
  headerBtn: {
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 15,
  },
  avatar: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 2,
    borderColor: "#fff",
  },
  editAvatarBtn: {
    position: "absolute",
    bottom: -5,
    right: -5,
    backgroundColor: "#666",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  memberText: {
    color: "#fff",
    fontSize: 11,
    marginRight: 2,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: "#fff",
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  vipBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginTop: -15,
    marginBottom: 10,
    padding: 15,
    borderRadius: 10,
    elevation: 5,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 4px 5px rgba(0, 0, 0, 0.1)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
        }),
  },
  vipBadge: {
    backgroundColor: "#ffc107",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  vipText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  vipDescription: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  section: {
    backgroundColor: "#fff",
    marginBottom: 10,
    paddingHorizontal: 0,
    paddingVertical: 15,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 16,
    paddingHorizontal: 10,
    fontWeight: "bold",
    color: "#333",
  },
  seeAll: {
    fontSize: 14,
    color: Colors.light.tint,
  },
  orderActions: actionStyles.orderActions,
  myUtilityGrid: {
    marginTop: 10,
    paddingHorizontal: 15,
  },
  utilityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  utilityCard: {
    width: "48%",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 15,
  },
  utilityCardIcon: {
    position: "relative",
    marginBottom: 10,
  },
  utilityCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  utilityCardSubtitle: {
    fontSize: 12,
    color: "#ee4d2d",
  },
  redDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ee4d2d",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ee4d2d",
  },
  signOutBtnDisabled: {
    opacity: 0.7,
  },
  signOutText: {
    color: "#ee4d2d",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
