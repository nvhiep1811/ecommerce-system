import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { orderService } from '@/services/orderService';
import { Order } from '@/types/order';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface OrderWithItems extends Order {
  items: any[];
}

const getItems = (order: OrderWithItems) => order.items ?? [];

export default function PendingOrdersScreen() {
  const { user, profile } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPendingOrders = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        if (profile?.role === 'seller') {
          const pendingOrders = await orderService.getOrdersByStatus('pending');
          setOrders(pendingOrders as OrderWithItems[]);
        } else {
          const allOrders = await orderService.getOrdersByUser(user.id);
          setOrders(allOrders.filter((order) => order.status === 'pending') as OrderWithItems[]);
        }
      } catch (error) {
        console.error('Error loading pending orders:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadPendingOrders();
  }, [profile?.role, user?.id]);

  const handleConfirmOrder = async (orderId: number) => {
    try {
      await orderService.updateOrder(orderId, { status: 'confirmed' });
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, status: 'confirmed' } : order)),
      );
      Alert.alert('Success', 'Order confirmed successfully');
    } catch (error) {
      console.error('Error confirming order:', error);
      Alert.alert('Error', 'Failed to confirm order');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Cho xac nhan';
      case 'confirmed':
        return 'Da xac nhan';
      case 'shipped':
        return 'Dang giao';
      case 'delivered':
        return 'Da giao';
      case 'cancelled':
        return 'Da huy';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#fff3cd';
      case 'confirmed':
        return '#d1ecf1';
      case 'shipped':
      case 'delivered':
        return '#d4edda';
      case 'cancelled':
        return '#f8d7da';
      default:
        return '#f8f9fa';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#856404';
      case 'confirmed':
        return '#0c5460';
      case 'shipped':
      case 'delivered':
        return '#155724';
      case 'cancelled':
        return '#721c24';
      default:
        return '#6c757d';
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {profile?.role === 'seller' ? 'Pending Orders Management' : 'Orders Pending'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {orders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Khong co don hang nao dang cho xu ly</Text>
          </View>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={orders}
            keyExtractor={(order) => order.id.toString()}
            renderItem={({ item: order }) => (
              <TouchableOpacity
                style={styles.orderCard}
                onPress={() => router.push(`/orders/orderdetail?orderId=${order.id}`)}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderId}>Order #{order.id}</Text>
                  <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                </View>

                <View style={styles.orderStatus}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
                    <Text style={[styles.statusText, { color: getStatusTextColor(order.status) }]}>
                      {getStatusText(order.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemsList}>
                  {getItems(order).slice(0, 2).map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <Image source={{ uri: item.products?.thumbnail }} style={styles.itemImage} />
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.products?.name || 'San pham khong xac dinh'}
                        </Text>
                        <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
                      </View>
                      <Text style={styles.itemPrice}>${Number(item.price ?? 0).toFixed(2)}</Text>
                    </View>
                  ))}
                  {getItems(order).length > 2 && (
                    <Text style={styles.moreItems}>+{getItems(order).length - 2} san pham khac</Text>
                  )}
                </View>

                <View style={styles.orderFooter}>
                  <Text style={styles.totalLabel}>Total:</Text>
                  <Text style={styles.totalAmount}>${order.total.toFixed(2)}</Text>
                </View>

                {profile?.role === 'seller' && order.status === 'pending' && (
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      style={styles.confirmButton}
                      onPress={() => handleConfirmOrder(order.id)}
                    >
                      <Text style={styles.confirmButtonText}>Confirm Order</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.tint,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
  },
  orderStatus: {
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '600',
  },
  itemsList: {
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#333',
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#666',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  moreItems: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.light.tint,
  },
  actionsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  confirmButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
