import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { CartItem } from "@/types/cart";
import { formatCurrencyVnd } from "@/utils/format";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const CartItemRow = React.memo(
  function CartItemRow({
    item,
    isSelected,
    onToggleSelect,
    onDecreaseQuantity,
    onIncreaseQuantity,
    onRemoveItem,
  }: {
    item: CartItem;
    isSelected: boolean;
    onToggleSelect: (productId: number) => void;
    onDecreaseQuantity: (productId: number, quantity: number) => void;
    onIncreaseQuantity: (productId: number, quantity: number) => void;
    onRemoveItem: (productId: number) => void;
  }) {
    const stock = Number(item.product.stock ?? 0);
    const isOutOfStock = stock <= 0;
    const isLowStock = stock > 0 && stock <= 5;
    const quantityAtLimit = stock > 0 && item.quantity >= stock;

    return (
      <View style={[styles.cartItem, isOutOfStock && styles.cartItemMuted]}>
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => {
            if (!isOutOfStock) {
              onToggleSelect(item.product.id);
            }
          }}
          disabled={isOutOfStock}
        >
          <View
            style={[
              styles.checkbox,
              isSelected && styles.checkboxSelected,
              isOutOfStock && styles.checkboxDisabled,
            ]}
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
          <Text style={styles.cartItemPrice}>
            {formatCurrencyVnd(item.product.price)}
          </Text>
          <Text
            style={[
              styles.stockText,
              isLowStock && styles.lowStockText,
              isOutOfStock && styles.outOfStockText,
            ]}
          >
            {isOutOfStock
              ? "Hết hàng, vui lòng xóa khỏi giỏ."
              : isLowStock
                ? `Sắp hết: còn ${stock} sản phẩm`
                : `Còn ${stock} sản phẩm`}
          </Text>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={[
                styles.quantityButton,
                item.quantity <= 1 && styles.quantityButtonDisabled,
              ]}
              onPress={() =>
                onDecreaseQuantity(item.product.id, item.quantity - 1)
              }
              disabled={item.quantity <= 1}
            >
              <Ionicons
                name="remove"
                size={16}
                color={item.quantity <= 1 ? "#bdbdbd" : "#666"}
              />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              style={[
                styles.quantityButton,
                (isOutOfStock || quantityAtLimit) &&
                  styles.quantityButtonDisabled,
              ]}
              onPress={() =>
                onIncreaseQuantity(item.product.id, item.quantity + 1)
              }
              disabled={isOutOfStock || quantityAtLimit}
            >
              <Ionicons
                name="add"
                size={16}
                color={isOutOfStock || quantityAtLimit ? "#bdbdbd" : "#666"}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemoveItem(item.product.id)}
        >
          <Ionicons name="trash-outline" size={20} color="red" />
        </TouchableOpacity>
      </View>
    );
  },
  (prev, next) => {
    const prevItem = prev.item;
    const nextItem = next.item;

    return (
      prev.isSelected === next.isSelected &&
      prevItem.quantity === nextItem.quantity &&
      prevItem.product.id === nextItem.product.id &&
      prevItem.product.name === nextItem.product.name &&
      prevItem.product.price === nextItem.product.price &&
      prevItem.product.stock === nextItem.product.stock &&
      prevItem.product.thumbnail === nextItem.product.thumbnail
    );
  },
);

export default function CartScreen() {
  const { user } = useAuth();
  const { cartItems, removeFromCart, updateQuantity, refreshCartProducts } =
    useCart();
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [checkoutNavigating, setCheckoutNavigating] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<"login" | "remove">("login");
  const [pendingRemoveProductId, setPendingRemoveProductId] = useState<
    number | null
  >(null);

  useFocusEffect(
    useCallback(() => {
      setCheckoutNavigating(false);
      void refreshCartProducts();
    }, [refreshCartProducts]),
  );

  useEffect(() => {
    setSelectedItems((prev) => {
      const availableProductIds = new Set(
        cartItems
          .filter((item) => Number(item.product.stock ?? 0) > 0)
          .map((item) => item.product.id),
      );
      return new Set(
        [...prev].filter((productId) => availableProductIds.has(productId)),
      );
    });
  }, [cartItems]);

  const isItemAvailable = useCallback(
    (productId: number) => {
      const item = cartItems.find(
        (cartItem) => cartItem.product.id === productId,
      );
      return Number(item?.product.stock ?? 0) > 0;
    },
    [cartItems],
  );

  const toggleSelectItem = useCallback((productId: number) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else if (isItemAvailable(productId)) {
        newSet.add(productId);
      }
      return newSet;
    });
  }, [isItemAvailable]);

  const selectAll = useCallback(() => {
    const availableIds = cartItems
      .filter((item) => Number(item.product.stock ?? 0) > 0)
      .map((item) => item.product.id);
    if (selectedItems.size === availableIds.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(availableIds));
    }
  }, [selectedItems.size, cartItems]);

  const selectedTotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      if (
        selectedItems.has(item.product.id) &&
        Number(item.product.stock ?? 0) > 0
      ) {
        return total + item.product.price * item.quantity;
      }
      return total;
    }, 0);
  }, [cartItems, selectedItems]);

  const availableCartItemsCount = useMemo(
    () =>
      cartItems.filter((item) => Number(item.product.stock ?? 0) > 0).length,
    [cartItems],
  );

  const handleCheckout = useCallback(() => {
    if (selectedItems.size === 0 || checkoutNavigating) {
      return;
    }

    if (!user?.id) {
      setModalMode("login");
      setModalVisible(true);
      return;
    }

    const selectedProductIds = Array.from(selectedItems).filter(isItemAvailable);
    if (selectedProductIds.length === 0) {
      return;
    }
    setCheckoutNavigating(true);
    router.navigate({
      pathname: "/orders/invoice",
      params: {
        selected: selectedProductIds.join(","),
      },
    });
  }, [checkoutNavigating, isItemAvailable, selectedItems, user?.id]);

  const closeModal = () => {
    setModalVisible(false);
    setPendingRemoveProductId(null);
  };

  const handlePrimaryModalAction = () => {
    if (modalMode === "login") {
      closeModal();
      router.navigate("/login");
      return;
    }

    if (pendingRemoveProductId !== null) {
      removeFromCart(pendingRemoveProductId);
      setSelectedItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(pendingRemoveProductId);
        return newSet;
      });
    }

    closeModal();
  };

  const handleCancelModal = () => {
    closeModal();
  };

  const handleRemoveItem = useCallback((productId: number) => {
    setModalMode("remove");
    setPendingRemoveProductId(productId);
    setModalVisible(true);
  }, []);

  const renderCartItem = useCallback(
    ({ item }: { item: CartItem }) => (
      <CartItemRow
        item={item}
        isSelected={selectedItems.has(item.product.id)}
        onToggleSelect={toggleSelectItem}
        onDecreaseQuantity={updateQuantity}
        onIncreaseQuantity={updateQuantity}
        onRemoveItem={handleRemoveItem}
      />
    ),
    [selectedItems, toggleSelectItem, updateQuantity, handleRemoveItem],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }
              router.replace("/(tabs)");
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Giỏ hàng</Text>
        <View style={styles.headerSide} />
      </View>

      {cartItems.length > 0 ? (
        <View style={styles.selectAllContainer}>
          <TouchableOpacity style={styles.selectAllButton} onPress={selectAll}>
            <View
              style={[
                styles.checkbox,
                availableCartItemsCount > 0 &&
                  selectedItems.size === availableCartItemsCount &&
                  styles.checkboxSelected,
              ]}
            >
              {availableCartItemsCount > 0 &&
              selectedItems.size === availableCartItemsCount ? (
                <Ionicons name="checkmark" size={16} color="white" />
              ) : null}
            </View>
            <Text style={styles.selectAllText}>
              {availableCartItemsCount > 0 &&
              selectedItems.size === availableCartItemsCount
                ? "Bỏ chọn tất cả"
                : "Chọn tất cả"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        style={styles.contentScroll}
        contentContainerStyle={
          cartItems.length === 0 ? styles.contentEmpty : undefined
        }
        data={cartItems}
        renderItem={renderCartItem}
        extraData={selectedItems}
        keyExtractor={(item) => item.product.id.toString()}
        numColumns={1}
        initialNumToRender={6}
        windowSize={5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Giỏ hàng của bạn đang trống</Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => router.navigate("/(tabs)")}
            >
              <Text style={styles.shopButtonText}>Mua sắm ngay</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {cartItems.length > 0 ? (
        <View style={styles.footer}>
          <View style={styles.totalContainer}>
            <Text style={styles.selectedCountText}>
              Đã chọn {selectedItems.size} sản phẩm
            </Text>
            <Text style={styles.totalText}>
              Tổng: {formatCurrencyVnd(selectedTotal)}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.checkoutButton,
              (selectedItems.size === 0 || checkoutNavigating) &&
                styles.checkoutButtonDisabled,
            ]}
            disabled={selectedItems.size === 0 || checkoutNavigating}
            onPress={handleCheckout}
          >
            <Text style={styles.checkoutText}>Thanh toán</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ConfirmActionModal
        visible={modalVisible}
        title={
          modalMode === "login"
            ? "Bạn cần đăng nhập để thanh toán"
            : "Xóa sản phẩm khỏi giỏ hàng?"
        }
        message={
          modalMode === "login"
            ? "Vui lòng đăng nhập hoặc tạo tài khoản để tiếp tục đặt hàng."
            : "Sản phẩm này sẽ bị xóa khỏi giỏ hàng của bạn."
        }
        confirmLabel={modalMode === "login" ? "Đăng nhập" : "Xóa"}
        destructive={modalMode === "remove"}
        onConfirm={handlePrimaryModalAction}
        onCancel={handleCancelModal}
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
  checkboxDisabled: {
    backgroundColor: "#f2f2f2",
    borderColor: "#ddd",
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
  contentEmpty: {
    flexGrow: 1,
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
  cartItemMuted: {
    opacity: 0.72,
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
    marginBottom: 3,
  },
  stockText: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
  },
  lowStockText: {
    color: "#d97706",
    fontWeight: "600",
  },
  outOfStockText: {
    color: "#dc2626",
    fontWeight: "700",
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
  quantityButtonDisabled: {
    backgroundColor: "#f5f5f5",
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
    backgroundColor: "#f5f5f5",
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
});
