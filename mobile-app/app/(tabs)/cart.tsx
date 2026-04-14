import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { CartItem } from "@/types/cart";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function CartScreen() {
  const { user } = useAuth();
  const { cartItems, removeFromCart, updateQuantity } = useCart();
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);

  const toggleSelectItem = useCallback((productId: number) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedItems.size === cartItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(cartItems.map((item) => item.product.id)));
    }
  }, [selectedItems.size, cartItems]);

  const selectedTotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      if (selectedItems.has(item.product.id)) {
        return total + item.product.price * item.quantity;
      }
      return total;
    }, 0);
  }, [cartItems, selectedItems]);

  const handleCheckout = useCallback(() => {
    if (selectedItems.size === 0) {
      return;
    }

    if (!user?.id) {
      setModalVisible(true);
      return;
    }

    const selectedProductIds = Array.from(selectedItems);
    router.push({
      pathname: "/orders/invoice",
      params: {
        selected: selectedProductIds.join(","),
      },
    });
  }, [selectedItems, user?.id]);

  const handleAgree = () => {
    setModalVisible(false);
    router.push("/login");
  };

  const handleCancel = () => {
    setModalVisible(false);
  };

  const handleRemoveItem = useCallback(
    (productId: number) => {
      removeFromCart(productId);
      setSelectedItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    },
    [removeFromCart],
  );

  const renderCartItem = useCallback(
    ({ item }: { item: CartItem }) => {
      const isSelected = selectedItems.has(item.product.id);

      return (
        <View style={styles.cartItem}>
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => toggleSelectItem(item.product.id)}
          >
            <View
              style={[styles.checkbox, isSelected && styles.checkboxSelected]}
            >
              {isSelected ? (
                <Ionicons name="checkmark" size={16} color="white" />
              ) : null}
            </View>
          </TouchableOpacity>

          <Image
            source={{ uri: item.product.thumbnail || undefined }}
            style={styles.cartItemImage}
          />

          <View style={styles.cartItemDetails}>
            <Text style={styles.cartItemName}>{item.product.name}</Text>
            <Text style={styles.cartItemPrice}>${item.product.price}</Text>
            <View style={styles.quantityContainer}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() =>
                  updateQuantity(item.product.id, item.quantity - 1)
                }
              >
                <Ionicons name="remove" size={16} color="#666" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() =>
                  updateQuantity(item.product.id, item.quantity + 1)
                }
              >
                <Ionicons name="add" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveItem(item.product.id)}
          >
            <Ionicons name="trash-outline" size={20} color="red" />
          </TouchableOpacity>
        </View>
      );
    },
    [selectedItems, toggleSelectItem, updateQuantity, handleRemoveItem],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
        <View style={{ width: 40 }} />
      </View>

      {cartItems.length > 0 ? (
        <View style={styles.selectAllContainer}>
          <TouchableOpacity style={styles.selectAllButton} onPress={selectAll}>
            <View
              style={[
                styles.checkbox,
                selectedItems.size === cartItems.length &&
                  styles.checkboxSelected,
              ]}
            >
              {selectedItems.size === cartItems.length ? (
                <Ionicons name="checkmark" size={16} color="white" />
              ) : null}
            </View>
            <Text style={styles.selectAllText}>
              {selectedItems.size === cartItems.length
                ? "Deselect All"
                : "Select All"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        style={styles.contentScroll}
        data={cartItems}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.product.id.toString()}
        numColumns={1}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Your cart is empty</Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => router.push("/")}
            >
              <Text style={styles.shopButtonText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {cartItems.length > 0 ? (
        <View style={styles.footer}>
          <View style={styles.totalContainer}>
            <Text style={styles.selectedCountText}>
              {selectedItems.size} selected
            </Text>
            <Text style={styles.totalText}>
              Total: ${selectedTotal.toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.checkoutButton,
              selectedItems.size === 0 && styles.checkoutButtonDisabled,
            ]}
            disabled={selectedItems.size === 0}
            onPress={handleCheckout}
          >
            <Text style={styles.checkoutText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              You need an account to complete your purchase
            </Text>
            <Text style={styles.modalMessage}>
              Create an account or sign in to continue to checkout.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.agreeButton}
                onPress={handleAgree}
              >
                <Text style={styles.agreeText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  selectAllContainer: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  selectAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  selectAllText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  contentScroll: {
    flex: 1,
  },
  cartItem: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 8,
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 3,
    alignItems: "center",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }),
  },
  checkboxContainer: {
    marginRight: 12,
  },
  cartItemImage: {
    width: 70,
    height: 70,
    borderRadius: 6,
    marginRight: 12,
  },
  cartItemDetails: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: Colors.light.tint,
    marginBottom: 6,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    width: 28,
    height: 28,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    marginHorizontal: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    minWidth: 20,
    textAlign: "center",
  },
  removeButton: {
    paddingHorizontal: 8,
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
  shopButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  footer: {
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalContainer: {
    flex: 1,
  },
  selectedCountText: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  totalText: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.tint,
  },
  checkoutButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkoutButtonDisabled: {
    backgroundColor: "#ccc",
  },
  checkoutText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  agreeButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: "center",
  },
  agreeText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    backgroundColor: "#ccc",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    flex: 1,
    marginLeft: 10,
    alignItems: "center",
  },
  cancelText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "bold",
  },
});
