// app/(tabs)/profile.tsx
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { orderService } from '@/services/orderService';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// --- COMPONENTS TÁI SỬ DỤNG ---

const MenuItem = ({ icon, title, subtitle, onPress, badge }: any) => (
  <TouchableOpacity style={menuStyles.menuItem} onPress={onPress}>
    <View style={menuStyles.menuIcon}>
      <Ionicons name={icon} size={22} color="#ee4d2d" />
    </View>
    <View style={menuStyles.menuContent}>
      <Text style={menuStyles.menuTitle}>{title}</Text>
      {subtitle && <Text style={menuStyles.menuSubtitle}>{subtitle}</Text>}
    </View>
    {badge && (
      <View style={menuStyles.badge}>
        <Text style={menuStyles.badgeText}>{badge}</Text>
      </View>
    )}
    <Ionicons name="chevron-forward" size={18} color="#ccc" />
  </TouchableOpacity>
);

const QuickAction = ({ icon, title, onPress, badge }: any) => (
  <TouchableOpacity style={actionStyles.quickAction} onPress={onPress}>
    <View style={actionStyles.quickActionIcon}>
      <Ionicons name={icon} size={28} color="#ee4d2d" />
      {badge && badge > 0 && (
        <View style={actionStyles.badge}>
          <Text style={actionStyles.badgeText}>{badge}</Text>
        </View>
      )}
    </View>
    <Text style={actionStyles.quickActionText}>{title}</Text>
  </TouchableOpacity>
);

// --- PROFILE SCREEN CHÍNH ---

export default function ProfileScreen() {
  const { user, profile, signOut, isLoading } = useAuth();
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  const handleSignOutConfirmed = async () => {
    console.log('Starting sign out process...');
    try {
      await signOut();
      
      // KHẮC PHỤC LỖI: Xóa router.replace để tránh xung đột trạng thái.
      // Logic if (!user) sẽ tự động hiển thị màn hình đăng nhập.
      console.log('Sign out successful. State change should handle navigation.');
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Lỗi', 'Không thể đăng xuất. Vui lòng thử lại.');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'logout', 'Are you sure you want to log out?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: handleSignOutConfirmed,
        },
      ]
    );
  };

  useEffect(() => {
    if (!user) {
      setPendingOrdersCount(0);
      return;
    }

    const loadPendingOrdersCount = async () => {
      try {
        const orders = await orderService.getOrdersByUser(user.id);
        const pendingOrders = orders.filter((order) => order.status === 'pending');
        setPendingOrdersCount(pendingOrders.length);
      } catch (error) {
        console.error('Error fetching pending orders count:', error);
      }
    };

    void loadPendingOrdersCount();
  }, [user]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Đang tải...</Text>
      </View>
    );
  }

  // Màn hình khi chưa đăng nhập
  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="person-circle-outline" size={80} color="#ccc" />
        <Text style={styles.notLoggedText}>Login Here</Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.replace('/loginform/loginscreen')}
        >
          <Text style={styles.loginBtnText}>Sign In Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="settings-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="cart-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#fff" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/80' }}
              style={styles.avatar}
            />
            {/* Nút sửa avatar chỉ nên là một icon nhỏ, không cần viền đỏ nổi bật */}
            <TouchableOpacity style={styles.editAvatarBtn}>
              <Ionicons name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>{profile?.full_name || user.email}</Text>
            <TouchableOpacity style={styles.memberBadge}>
              <Text style={styles.memberText}>Thành viên</Text>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
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

      {/* VIP Banner */}
      <TouchableOpacity style={styles.vipBanner}>
        <View style={styles.vipBadge}>
          <Text style={styles.vipText}> VIP</Text>
        </View>
        <Text style={styles.vipDescription}>200+ Voucher mỗi tháng chỉ với 29k!</Text>
        <Ionicons name="chevron-forward" size={20} color="#ee4d2d" />
      </TouchableOpacity>

      {/* Đơn mua */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Orders</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>View Purchase History</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.orderActions}>
        <QuickAction icon="wallet-outline" title="Pending Confirmation" badge={pendingOrdersCount} onPress={() => router.replace('/orders/pendingorders')} />
        <QuickAction icon="cube-outline" title="To Be Picked Up" />
        <QuickAction icon="car-outline" title="On Delivery" />
         <QuickAction icon="star-outline" title="To Review" />
        </View>

      </View>

      {/* Tiện ích của tôi */}
      <View style={styles.section}>
  <Text style={styles.sectionTitle}>My Utilities</Text>
  <View style={styles.myUtilityGrid}>
    {/* Adjusted utilityCard style for better right alignment */}
    <TouchableOpacity style={[styles.utilityCard, { marginRight: '4%' }]}>
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

    <TouchableOpacity style={[styles.utilityCard, { marginRight: '4%' }]}>
      <View style={styles.utilityCardIcon}>
        <Ionicons name="diamond" size={28} color="#ee4d2d" />
        <View style={styles.redDot} />
      </View>
      <Text style={styles.utilityCardTitle}>MegaPoints</Text>
      <Text style={styles.utilityCardSubtitle}>Earn points every day!</Text>
    </TouchableOpacity>

    <TouchableOpacity style={[styles.utilityCard, { marginRight: 0 }]}>
      <View style={styles.utilityCardIcon}>
        <Ionicons name="ticket" size={28} color="#ee4d2d" />
        <View style={styles.redDot} />
      </View>
      <Text style={styles.utilityCardTitle}>Voucher Repository</Text>
      <Text style={styles.utilityCardSubtitle}>50+ vouchers available</Text>
    </TouchableOpacity>
  </View>
</View>

      
      {/* Seller Dashboard (only for sellers) */}
      {profile?.role === 'seller' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seller Dashboard</Text>
          <View style={{ gap: 5 }}>
            <MenuItem
              icon="cube"
              title="My Products"
              onPress={() => router.push('/seller/products' as any)}
            />
            <MenuItem
              icon="clipboard"
              title="Order Management"
              onPress={() => router.push('/seller/orders' as any)}
            />
            <MenuItem icon="stats-chart" title="Sales Analytics" />
          </View>
        </View>
      )}

      {/* Tiện ích khác */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tiện ích khác</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>Xem tất cả</Text>
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


      {/* Hỗ trợ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Supports</Text>
        <View style={{ gap: 5 }}>
          <MenuItem
            icon="help-circle-outline"
            title="Help Center"
          />
          <MenuItem
            icon="headset-outline"
            title="Say With MegaMall"
          />
          <MenuItem
            icon="document-text-outline"
            title="MegaMall Blog"
          />
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={24} color="#ee4d2d" />
        <Text style={styles.signOutText}>Log Out</Text>
      </TouchableOpacity>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

// --- STYLES MỚI (CHỈ SỬA NHỮNG PHẦN CẦN THIẾT) ---
const menuStyles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14, // Tăng nhẹ padding
    paddingHorizontal: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1, // Thêm đường gạch mỏng
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    marginRight: 15,
    width: 30, // Cố định chiều rộng icon
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#ee4d2d',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

const actionStyles = StyleSheet.create({
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 10,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff5f5', // Nền nhạt hơn
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    // Bỏ bóng đổ ở đây cho gọn gàng hơn
  },
  quickActionText: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ee4d2d',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});


const styles = StyleSheet.create({
  // ... (Giữ nguyên các styles chung)
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  notLoggedText: {
    fontSize: 18,
    color: '#333',
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Header
  header: {
    backgroundColor: Colors.light.tint,
    paddingTop: 40, // Tăng padding top cho iPhone notch
    paddingBottom: 20,
    paddingHorizontal: 15,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 15,
    marginBottom: 20,
  },
  headerBtn: {
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  // Profile Section
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 65, // Nhỏ lại một chút
    height: 65,
    borderRadius: 32.5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: -2, // Dịch xuống góc dưới
    right: -2,
    backgroundColor: '#666',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18, // Nhỏ lại một chút
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)', // Màu sậm hơn
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  memberText: {
    color: '#fff',
    fontSize: 11,
    marginRight: 2,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#fff',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  // VIP Banner
  vipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: -15, // Kéo lên
    marginBottom: 10,
    padding: 15,
    borderRadius: 10, // Bo góc hơn
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, // Bóng đổ nổi bật hơn
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  vipBadge: {
    backgroundColor: '#ffc107', // Màu vàng sang trọng
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  vipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  vipDescription: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },

  // Section
  section: {
    backgroundColor: '#fff',
    marginBottom: 10,
    paddingHorizontal: 0, // Bỏ padding ngang ở đây, để MenuItem tự quản lý
    paddingVertical: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 15, // Chỉ áp dụng padding ngang cho header
  },
  sectionTitle: {
    fontSize: 16,
    paddingHorizontal:10,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAll: {
    fontSize: 14,
    color: Colors.light.tint, // Đổi màu xem tất cả
  },

  // Order Actions (Dùng actionStyles bên trên)
  orderActions: actionStyles.orderActions,

  // My Utility Grid
  myUtilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    paddingHorizontal: 15, // Thêm padding cho grid
    justifyContent: 'space-between',
  },
  utilityCard: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  utilityCardIcon: {
    position: 'relative',
    marginBottom: 10,
  },
  utilityCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  utilityCardSubtitle: {
    fontSize: 12,
    color: '#ee4d2d',
  },
  redDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ee4d2d',
  },

  // Sign Out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 10,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ee4d2d',
  },
  signOutText: {
    color: '#ee4d2d',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
