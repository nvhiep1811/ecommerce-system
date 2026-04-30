import ProductDetailSkeleton from "@/components/ProductDetailSkeleton";
import Button from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { productService } from "@/services/productService";
import { Product } from "@/types/product";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const timeout = (ms: number): Promise<never> =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Yêu cầu quá thời gian chờ")), ms),
  );

const requestProductDetails = async (productId: number): Promise<Product> =>
  Promise.race([productService.getProductById(productId), timeout(10000)]);

export default function ProductDetail() {
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const { addToCart, getTotalItems } = useCart();
  const { user } = useAuth();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)");
  };

  useEffect(() => {
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      setError("Mã sản phẩm không hợp lệ");
      setLoading(false);
      return;
    }

    let active = true;

    const loadProductDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await requestProductDetails(productId);

        if (active) {
          setProduct(data);
          setSelectedQuantity((current) =>
            data.stock > 0 ? Math.min(current, data.stock) : 1,
          );
        }
      } catch (fetchError) {
        if (active) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Không thể tải sản phẩm",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProductDetails();

    return () => {
      active = false;
    };
  }, [id]);

  const handleRetry = async () => {
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      setError("Mã sản phẩm không hợp lệ");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await requestProductDetails(productId);
      setProduct(data);
      setSelectedQuantity((current) =>
        data.stock > 0 ? Math.min(current, data.stock) : 1,
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Không thể tải sản phẩm",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product || product.stock <= 0) {
      return;
    }

    addToCart(product, selectedQuantity);
  };

  const handleBuyNow = () => {
    if (!product || product.stock <= 0) {
      return;
    }

    if (user) {
      router.navigate({
        pathname: "/orders/invoice",
        params: {
          buyNowProductId: String(product.id),
          buyNowQuantity: String(selectedQuantity),
        },
      });
      return;
    }

    setModalVisible(true);
  };

  if (loading) {
    return <ProductDetailSkeleton />;
  }

  if (error) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <Button title="Thử lại" onPress={handleRetry} />
      </ThemedView>
    );
  }

  const isOutOfStock = Boolean(product && product.stock <= 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={26} color="white" />
            </TouchableOpacity>
          </View>
          <ThemedText style={styles.headerTitle}>Chi tiết sản phẩm</ThemedText>
          <View style={styles.headerSide}>
            <TouchableOpacity
              onPress={() => router.navigate("/(tabs)/cart")}
              style={styles.cartButton}
            >
              <Ionicons name="cart-outline" size={26} color="white" />
              {getTotalItems() > 0 && (
                <View style={styles.cartBadge}>
                  <ThemedText style={styles.cartBadgeText}>
                    {getTotalItems()}
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {product ? (
            <ThemedView style={styles.content}>
              <Image
                source={
                  product.thumbnail
                    ? { uri: product.thumbnail }
                    : require("../../assets/images/favicon.png")
                }
                style={styles.productImage}
              />
              <ThemedText style={styles.productName}>{product.name}</ThemedText>
              <ThemedText
                style={styles.productBrand}
              >{`Bởi ${product.brand || "Người bán"}`}</ThemedText>

              <View style={styles.priceRow}>
                <ThemedText style={styles.productPrice}>
                  {formatCurrencyVnd(product.price)}
                </ThemedText>
              </View>

              <View style={styles.quantitySection}>
                <ThemedText style={styles.quantityLabel}>Số lượng</ThemedText>
                <View style={styles.quantityStepper}>
                  <TouchableOpacity
                    style={[
                      styles.quantityButton,
                      selectedQuantity <= 1 && styles.quantityButtonDisabled,
                    ]}
                    onPress={() =>
                      setSelectedQuantity((current) => Math.max(1, current - 1))
                    }
                    disabled={selectedQuantity <= 1}
                  >
                    <Ionicons
                      name="remove"
                      size={18}
                      color={
                        selectedQuantity <= 1 ? "#9ca3af" : Colors.light.tint
                      }
                    />
                  </TouchableOpacity>
                  <ThemedText style={styles.quantityValue}>
                    {selectedQuantity}
                  </ThemedText>
                  <TouchableOpacity
                    style={[
                      styles.quantityButton,
                      selectedQuantity >= product.stock &&
                        styles.quantityButtonDisabled,
                    ]}
                    onPress={() =>
                      setSelectedQuantity((current) =>
                        product.stock > 0
                          ? Math.min(product.stock, current + 1)
                          : current,
                      )
                    }
                    disabled={
                      selectedQuantity >= product.stock || product.stock <= 0
                    }
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color={
                        selectedQuantity >= product.stock || product.stock <= 0
                          ? "#9ca3af"
                          : Colors.light.tint
                      }
                    />
                  </TouchableOpacity>
                </View>
                <ThemedText style={styles.quantityHint}>
                  {product.stock > 0
                    ? `Còn ${product.stock} sản phẩm`
                    : "Hết hàng"}
                </ThemedText>
              </View>

              <ThemedText style={styles.sectionTitle}>Mô tả</ThemedText>
              <ThemedText style={styles.productDescription}>
                {product.description || "Chưa có mô tả."}
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView style={styles.notFound}>
              <ThemedText style={styles.notFoundText}>
                Không tìm thấy sản phẩm
              </ThemedText>
              <Button title="Quay lại" onPress={handleBack} />
            </ThemedView>
          )}
        </ScrollView>

        {product && (
          <View style={styles.footerFixed}>
            <TouchableOpacity
              style={styles.addToCartButton}
              onPress={handleAddToCart}
              disabled={isOutOfStock}
            >
              <Ionicons name="cart-outline" size={20} color="white" />
              <ThemedText style={styles.addToCartText}>Thêm vào giỏ</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.buyNowButton}
              onPress={handleBuyNow}
              disabled={isOutOfStock}
            >
              <ThemedText style={styles.buyNowText}>Mua ngay</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        <Modal
          animationType="slide"
          transparent
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ThemedText style={styles.modalTitle}>
                Bạn cần đăng nhập để đặt hàng
              </ThemedText>
              <ThemedText style={styles.modalMessage}>
                Vui lòng đăng nhập hoặc tạo tài khoản để tiếp tục thanh toán.
              </ThemedText>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.agreeButton}
                  onPress={() => {
                    setModalVisible(false);
                    router.navigate("/login");
                  }}
                >
                  <ThemedText style={styles.agreeText}>Tiếp tục</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}
                >
                  <ThemedText style={styles.cancelText}>Để sau</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "white",
  },
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "red",
    fontSize: 18,
    marginBottom: 20,
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
  cartButton: {
    width: 40,
    height: 40,
    padding: 0,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "red",
  },
  cartBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    padding: 16,
  },
  productImage: {
    width: "100%",
    height: 300,
    borderRadius: 8,
    marginBottom: 16,
  },
  productName: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 14,
    color: "#888",
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  quantitySection: {
    marginBottom: 16,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  quantityStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(230,44,47,0.18)",
    backgroundColor: "rgba(230,44,47,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonDisabled: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
  },
  quantityValue: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  quantityHint: {
    marginTop: 6,
    fontSize: 12,
    color: "#6b7280",
  },
  productPrice: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.tint,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: "#555",
  },
  footerFixed: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    padding: 12,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundText: {
    color: "red",
    fontSize: 18,
    marginBottom: 20,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
  },
  addToCartText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  buyNowButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#ff6b35",
  },
  buyNowText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    alignItems: "center",
    borderRadius: 10,
    padding: 20,
    backgroundColor: "white",
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
    gap: 10,
  },
  agreeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    backgroundColor: Colors.light.tint,
  },
  agreeText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    backgroundColor: "#ccc",
  },
  cancelText: {
    color: "black",
    fontSize: 16,
    fontWeight: "bold",
  },
});
