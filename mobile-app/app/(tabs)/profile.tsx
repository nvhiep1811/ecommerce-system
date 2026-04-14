import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { orderService } from "@/services/orderService";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
  const { user, profile, signOut, isLoading } = useAuth();
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  const handleSignOutConfirmed = async () => {
    try {
      await signOut();
      router.replace("/");
    } catch (error) {
      void error;
      Alert.alert("Error", "Unable to sign out. Please try again.");
    }
  };

  const handleSignOut = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: handleSignOutConfirmed,
      },
    ]);
  };

  useEffect(() => {
    if (!user) {
      setPendingOrdersCount(0);
      return;
    }

    const loadPendingOrdersCount = async () => {
      try {
        const orders = await orderService.getOrdersByUser(user.id);
        const pendingOrders = orders.filter(
          (order) => order.status === "pending",
        );
        setPendingOrdersCount(pendingOrders.length);
      } catch (error) {
        void error;
      }
    };

    void loadPendingOrdersCount();
  }, [user]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="person-circle-outline" size={80} color="#ccc" />
        <Text style={styles.notLoggedText}>Sign in to view your profile</Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.replace("/login")}
        >
          <Text style={styles.loginBtnText}>Sign In</Text>
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
            onPress={() => router.push("/cart")}
          >
            <Ionicons name="cart-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
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
            <TouchableOpacity style={styles.editAvatarBtn}>
              <Ionicons name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile?.full_name || user.email}
            </Text>
            <TouchableOpacity style={styles.memberBadge}>
              <Text style={styles.memberText}>Member</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>8</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.vipBanner}>
        <View style={styles.vipBadge}>
          <Text style={styles.vipText}>VIP</Text>
        </View>
        <Text style={styles.vipDescription}>
          200+ vouchers every month for only 29K!
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#ee4d2d" />
      </TouchableOpacity>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Orders</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>View Purchase History</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.orderActions}>
          <QuickAction
            icon="wallet-outline"
            title="Pending Confirmation"
            badge={pendingOrdersCount}
            onPress={() => router.push("/orders/pending?status=pending")}
          />
          <QuickAction
            icon="cube-outline"
            title="To Be Picked Up"
            onPress={() => router.push("/orders/pending?status=confirmed")}
          />
          <QuickAction
            icon="car-outline"
            title="On Delivery"
            onPress={() => router.push("/orders/pending?status=shipped")}
          />
          <QuickAction
            icon="star-outline"
            title="To Review"
            onPress={() => router.push("/orders/pending?status=delivered")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Utilities</Text>
        <View style={styles.myUtilityGrid}>
          <TouchableOpacity style={[styles.utilityCard, { marginRight: "4%" }]}>
            <View style={styles.utilityCardIcon}>
              <Ionicons name="wallet" size={28} color="#ee4d2d" />
            </View>
            <Text style={styles.utilityCardTitle}>MegaPay Wallet</Text>
            <Text style={styles.utilityCardSubtitle}>Activate now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.utilityCard, { marginRight: 0 }]}>
            <View style={styles.utilityCardIcon}>
              <Ionicons name="card" size={28} color="#ee4d2d" />
            </View>
            <Text style={styles.utilityCardTitle}>MegaPay Later</Text>
            <Text style={styles.utilityCardSubtitle}>Buy now, pay later</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.utilityCard, { marginRight: "4%" }]}>
            <View style={styles.utilityCardIcon}>
              <Ionicons name="diamond" size={28} color="#ee4d2d" />
              <View style={styles.redDot} />
            </View>
            <Text style={styles.utilityCardTitle}>MegaPoints</Text>
            <Text style={styles.utilityCardSubtitle}>
              Earn points every day
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.utilityCard, { marginRight: 0 }]}>
            <View style={styles.utilityCardIcon}>
              <Ionicons name="ticket" size={28} color="#ee4d2d" />
              <View style={styles.redDot} />
            </View>
            <Text style={styles.utilityCardTitle}>Voucher Wallet</Text>
            <Text style={styles.utilityCardSubtitle}>
              50+ vouchers available
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {profile?.role === "seller" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seller Dashboard</Text>
          <View style={{ gap: 5 }}>
            <MenuItem
              icon="cube"
              title="My Products"
              onPress={() => router.push("/seller/products" as any)}
            />
            <MenuItem
              icon="clipboard"
              title="Order Management"
              onPress={() => router.push("/seller/orders" as any)}
            />
            <MenuItem icon="stats-chart" title="Sales Analytics" />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>More Utilities</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 5 }}>
          <MenuItem icon="people" title="Loyalty Program" />
          <MenuItem icon="bag-handle" title="Reorder" />
          <MenuItem icon="trending-up" title="Creator Hub" />
          <MenuItem icon="wallet" title="Mega Mall Balance" />
          <MenuItem icon="gift" title="Mega Mall Rewards" />
          <MenuItem icon="heart" title="Favorites" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={{ gap: 5 }}>
          <MenuItem icon="help-circle-outline" title="Help Center" />
          <MenuItem icon="headset-outline" title="Chat with MegaMall" />
          <MenuItem icon="document-text-outline" title="MegaMall Blog" />
        </View>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={24} color="#ee4d2d" />
        <Text style={styles.signOutText}>Log Out</Text>
      </TouchableOpacity>

      <View style={{ height: 30 }} />
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
    justifyContent: "space-around",
  },
  quickAction: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 10,
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
    bottom: -2,
    right: -2,
    backgroundColor: "#666",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
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
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    paddingHorizontal: 15,
    justifyContent: "space-between",
  },
  utilityCard: {
    width: "48%",
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
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
  signOutText: {
    color: "#ee4d2d",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
