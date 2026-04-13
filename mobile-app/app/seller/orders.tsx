import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { orderService } from '@/services/orderService';
import { Order } from '@/types/order';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface OrderWithItems extends Order {
  items: any[];
}

const getItems = (order: OrderWithItems) => order.items ?? [];

export default function SellerOrdersScreen() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role !== 'seller') {
      Alert.alert('Access Denied', 'You do not have permission to access this page');
      router.back();
      return;
    }

    const loadOrders = async () => {
      try {
        const pendingOrders = await orderService.getOrdersBySellerAndStatus(profile.id, 'pending');
        setOrders(pendingOrders as OrderWithItems[]);
      } catch (error) {
        console.error('Error loading orders:', error);
        Alert.alert('Error', 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    void loadOrders();
  }, [profile]);

  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      await orderService.updateOrder(orderId, { status: newStatus });
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order)),
      );
      Alert.alert('Success', `Order status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const getStatusActions = (status: string, orderId: number) => {
    switch (status) {
      case 'pending':
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUpdateOrderStatus(orderId, 'confirmed')}
          >
            <Text style={styles.actionButtonText}>Confirm</Text>
          </TouchableOpacity>
        );
      case 'confirmed':
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUpdateOrderStatus(orderId, 'shipped')}
          >
            <Text style={styles.actionButtonText}>Ship</Text>
          </TouchableOpacity>
        );
      case 'shipped':
        return (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUpdateOrderStatus(orderId, 'delivered')}
          >
            <Text style={styles.actionButtonText}>Mark Delivered</Text>
          </TouchableOpacity>
        );
      default:
        return null;
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

  const renderOrderItem = ({ item: order }: { item: OrderWithItems }) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>{order.order_no || `Order #${order.id}`}</Text>
        <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
      </View>

      <View style={styles.orderStatus}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
          <Text style={[styles.statusText, { color: getStatusTextColor(order.status) }]}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.itemsList}>
        {getItems(order).slice(0, 2).map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <Image source={{ uri: item.products?.thumbnail }} style={styles.itemImage} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.products?.name || 'Unknown Product'}
              </Text>
              <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
            </View>
            <Text style={styles.itemPrice}>${Number(item.price ?? 0).toFixed(2)}</Text>
          </View>
        ))}
        {getItems(order).length > 2 && (
          <Text style={styles.moreItems}>+{getItems(order).length - 2} more items</Text>
        )}
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.totalLabel}>Total:</Text>
        <Text style={styles.totalAmount}>${order.total.toFixed(2)}</Text>
      </View>

      <View style={styles.actionsContainer}>
        {getStatusActions(order.status, order.id)}
        <TouchableOpacity
          style={styles.viewDetailsButton}
          onPress={() => router.push(`/orders/orderdetail?orderId=${order.id}`)}
        >
          <Text style={styles.viewDetailsText}>View Details</Text>
        </TouchableOpacity>
      </View>
    </View>
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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Management</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        style={styles.content}
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        }
      />
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
  headerTitle: {
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
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 14,
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
    marginBottom: 12,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
  },
});
