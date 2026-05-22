import ProductDetailSkeleton from "@/components/ProductDetailSkeleton";
import Button from "@/components/themed-button";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { ApiError } from "@/services/apiClient";
import { flashSaleService } from "@/services/flashSaleService";
import { productService } from "@/services/productService";
import { FlashSaleItem } from "@/types/flashSale";
import { Product, ProductReview } from "@/types/product";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const timeout = (ms: number): Promise<never> =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Yêu cầu quá thời gian chờ")), ms),
  );

const requestProductDetails = async (productId: number): Promise<Product> =>
  Promise.race([productService.refreshProductById(productId), timeout(10000)]);

const parsePositiveNumber = (value?: string | string[]) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getFlashSaleBuyLimit = (
  product: Product,
  flashSale: FlashSaleItem | null,
) => {
  if (product.stock <= 0) {
    return 1;
  }

  if (!flashSale || flashSale.remaining_stock <= 0) {
    return product.stock;
  }

  return Math.max(
    1,
    Math.min(product.stock, flashSale.remaining_stock, flashSale.per_user_limit),
  );
};

const getFlashSaleErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.message.toLowerCase().includes("stock is not ready")) {
      return "Suất flash sale chưa sẵn sàng, vui lòng thử lại sau ít giây.";
    }

    if (error.status === 409) {
      return "Suất flash sale vừa hết hoặc bạn đã đạt giới hạn mua.";
    }

    if (error.status === 503 || error.status === 408) {
      return "Flash sale đang quá tải, vui lòng thử lại sau ít giây.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Không thể giữ suất flash sale.";
};

const getSellerDisplayName = (product: Product) => {
  if (product.seller_name?.trim()) {
    return product.seller_name.trim();
  }

  if (product.seller?.full_name?.trim()) {
    return product.seller.full_name.trim();
  }

  if (product.brand?.trim()) {
    return product.brand.trim();
  }


  return "Seller";
};

export default function ProductDetail() {
  const { id, flashSaleCampaignId, flashSaleItemId } = useLocalSearchParams<{
    id?: string;
    flashSaleCampaignId?: string;
    flashSaleItemId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [activeFlashSale, setActiveFlashSale] =
    useState<FlashSaleItem | null>(null);
  const [flashSaleClaiming, setFlashSaleClaiming] = useState(false);
  const [flashSaleError, setFlashSaleError] = useState<string | null>(null);
  const [isFavourite, setIsFavourite] = useState(false);
  const [favouriteLoading, setFavouriteLoading] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const { addToCart, getTotalItems } = useCart();
  const { user } = useAuth();
  const detailFocusedOnceRef = useRef(false);
  const selectedFlashSaleCampaignId = parsePositiveNumber(flashSaleCampaignId);
  const selectedFlashSaleItemId = parsePositiveNumber(flashSaleItemId);

  const loadFlashSaleItem = useCallback(
    async (productId: number) => {
      if (selectedFlashSaleCampaignId && selectedFlashSaleItemId) {
        const selectedItem = await flashSaleService.getActiveItem({
          campaignId: selectedFlashSaleCampaignId,
          itemId: selectedFlashSaleItemId,
        });

        if (selectedItem?.product_id === productId) {
          return selectedItem;
        }
      }

      return flashSaleService.getActiveItemByProduct(productId);
    },
    [selectedFlashSaleCampaignId, selectedFlashSaleItemId],
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)");
  };

  const loadProductEngagement = useCallback(
    async (productId: number) => {
      try {
        const productReviews = await productService.getProductReviews(productId);
        setReviews(productReviews.slice(0, 3));
      } catch {
        setReviews([]);
      }

      if (!user?.id) {
        setIsFavourite(false);
        return;
      }

      try {
        const favourite = await productService.getFavouriteStatus(productId);
        setIsFavourite(favourite);
      } catch {
        setIsFavourite(false);
      }
    },
    [user?.id],
  );

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
        const [data, flashSale] = await Promise.all([
          requestProductDetails(productId),
          loadFlashSaleItem(productId).catch(() => null),
        ]);

        if (active) {
          setProduct(data);
          setActiveFlashSale(flashSale);
          setFlashSaleError(null);
          setSelectedQuantity((current) =>
            data.stock > 0
              ? Math.min(current, getFlashSaleBuyLimit(data, flashSale))
              : 1,
          );
          void loadProductEngagement(data.id);
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
  }, [id, loadFlashSaleItem, loadProductEngagement]);

  useFocusEffect(
    useCallback(() => {
      const productId = Number(id);
      if (Number.isNaN(productId)) {
        return;
      }

      if (!detailFocusedOnceRef.current) {
        detailFocusedOnceRef.current = true;
        return;
      }

      let active = true;

      const refreshProductDetails = async () => {
        try {
          const [data, flashSale] = await Promise.all([
            requestProductDetails(productId),
            loadFlashSaleItem(productId).catch(() => null),
          ]);
          if (!active) {
            return;
          }

          setProduct(data);
          setActiveFlashSale(flashSale);
          setSelectedQuantity((current) =>
            data.stock > 0
              ? Math.min(current, getFlashSaleBuyLimit(data, flashSale))
              : 1,
          );
        } catch {
          // Keep the currently visible product detail if background refresh fails.
        }
      };

      void refreshProductDetails();

      return () => {
        active = false;
      };
    }, [id, loadFlashSaleItem]),
  );

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
      const [data, flashSale] = await Promise.all([
        requestProductDetails(productId),
        loadFlashSaleItem(productId).catch(() => null),
      ]);
      setProduct(data);
      setActiveFlashSale(flashSale);
      setFlashSaleError(null);
      setSelectedQuantity((current) =>
        data.stock > 0
          ? Math.min(current, getFlashSaleBuyLimit(data, flashSale))
          : 1,
      );
      void loadProductEngagement(data.id);
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

  const handleToggleFavourite = async () => {
    if (!product || favouriteLoading) {
      return;
    }

    if (!user?.id) {
      router.navigate("/login");
      return;
    }

    try {
      setFavouriteLoading(true);
      if (isFavourite) {
        await productService.removeFavourite(product.id);
        setIsFavourite(false);
      } else {
        await productService.addFavourite(product.id);
        setIsFavourite(true);
      }
    } finally {
      setFavouriteLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product || product.stock <= 0) {
      return;
    }

    if (!user) {
      setModalVisible(true);
      return;
    }

    const flashSaleAvailable =
      activeFlashSale !== null && activeFlashSale.remaining_stock > 0;

    if (!flashSaleAvailable) {
      router.push({
        pathname: "/orders/invoice",
        params: {
          buyNowProductId: String(product.id),
          buyNowQuantity: String(selectedQuantity),
        },
      });
      return;
    }

    try {
      setFlashSaleClaiming(true);
      setFlashSaleError(null);
      const claim = await flashSaleService.claim({
        campaignId: activeFlashSale.campaign_id,
        itemId: activeFlashSale.item_id,
        quantity: selectedQuantity,
      });

      router.push({
        pathname: "/orders/invoice",
        params: {
          buyNowProductId: String(product.id),
          buyNowQuantity: String(selectedQuantity),
          flashSaleCampaignId: String(activeFlashSale.campaign_id),
          flashSaleItemId: String(activeFlashSale.item_id),
          flashSaleReservationToken: claim.reservation_token,
          flashSalePrice: String(activeFlashSale.sale_price),
        },
      });
    } catch (error) {
      setFlashSaleError(getFlashSaleErrorMessage(error));
      flashSaleService
        .getActiveItem({
          campaignId: activeFlashSale.campaign_id,
          itemId: activeFlashSale.item_id,
        })
        .then(setActiveFlashSale)
        .catch(() => setActiveFlashSale(null));
    } finally {
      setFlashSaleClaiming(false);
    }
  };

  const handleChatWithSeller = () => {
    if (!product) {
      return;
    }

    router.navigate({
      pathname: "/chat/[id]" as any,
      params: {
        id: product.seller_id || product.seller?.id || "seller",
        sellerName: getSellerDisplayName(product),
        productName: product.name,
        productPrice: String(product.price),
        productImage: product.thumbnail ?? "",
      },
    });
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

  const isFlashSaleAvailable = Boolean(
    product && activeFlashSale && activeFlashSale.remaining_stock > 0,
  );
  const displayPrice =
    product && isFlashSaleAvailable && activeFlashSale
      ? activeFlashSale.sale_price
      : product?.price;
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
              onPress={() => router.replace("/(tabs)/cart")}
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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 100 + Math.max(insets.bottom, 8) },
          ]}
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
              <ThemedText style={styles.productBrand}>
                {`Bởi ${getSellerDisplayName(product)}`}
              </ThemedText>

              <View style={styles.priceRow}>
                <ThemedText style={styles.productPrice}>
                  {formatCurrencyVnd(displayPrice)}
                </ThemedText>
                {isFlashSaleAvailable &&
                activeFlashSale &&
                activeFlashSale.original_price > activeFlashSale.sale_price ? (
                  <ThemedText style={styles.originalPrice}>
                    {formatCurrencyVnd(activeFlashSale.original_price)}
                  </ThemedText>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.favoriteButton,
                    isFavourite && styles.favoriteButtonActive,
                  ]}
                  onPress={handleToggleFavourite}
                  disabled={favouriteLoading}
                >
                  <Ionicons
                    name={isFavourite ? "heart" : "heart-outline"}
                    size={22}
                    color={isFavourite ? "#fff" : Colors.light.tint}
                  />
                </TouchableOpacity>
              </View>

              {activeFlashSale ? (
                <View style={styles.flashSaleBox}>
                  <View style={styles.flashSaleTitleRow}>
                    <View style={styles.flashSaleBadge}>
                      <Ionicons name="flash" size={14} color="#fff" />
                      <ThemedText style={styles.flashSaleBadgeText}>
                        Flash Sale
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.flashSaleLimitText}>
                      Tối đa {activeFlashSale.per_user_limit}/khách
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.flashSalePrice}>
                    {formatCurrencyVnd(activeFlashSale.sale_price)}
                  </ThemedText>
                  <ThemedText style={styles.flashSaleMeta}>
                    {activeFlashSale.remaining_stock > 0
                      ? `Còn ${activeFlashSale.remaining_stock} suất giá tốt`
                      : "Suất flash sale đã hết, bạn vẫn có thể mua thường."}
                  </ThemedText>
                  {flashSaleError ? (
                    <ThemedText style={styles.flashSaleError}>
                      {flashSaleError}
                    </ThemedText>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color="#f59e0b" />
                <ThemedText style={styles.ratingText}>
                  {Number(product.rating || 0).toFixed(1)} ·{" "}
                  {product.review_count || 0} đánh giá
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
                          ? Math.min(
                              getFlashSaleBuyLimit(product, activeFlashSale),
                              current + 1,
                            )
                          : current,
                      )
                    }
                    disabled={
                      selectedQuantity >=
                        getFlashSaleBuyLimit(product, activeFlashSale) ||
                      product.stock <= 0
                    }
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color={
                        selectedQuantity >=
                          getFlashSaleBuyLimit(product, activeFlashSale) ||
                        product.stock <= 0
                          ? "#9ca3af"
                          : Colors.light.tint
                      }
                    />
                  </TouchableOpacity>
                </View>
                <ThemedText style={styles.quantityHint}>
                  {product.stock > 0
                    ? isFlashSaleAvailable
                      ? `Flash sale còn ${activeFlashSale?.remaining_stock} suất, tối đa ${activeFlashSale?.per_user_limit}/khách`
                      : `Còn ${product.stock} sản phẩm`
                    : "Hết hàng"}
                </ThemedText>
              </View>

              <ThemedText style={styles.sectionTitle}>Mô tả</ThemedText>
              <ThemedText style={styles.productDescription}>
                {product.description || "Chưa có mô tả."}
              </ThemedText>

              <View style={styles.reviewSectionHeader}>
                <ThemedText style={styles.sectionTitle}>
                  Đánh giá sản phẩm
                </ThemedText>
                <ThemedText style={styles.reviewCountText}>
                  {product.review_count || 0} đánh giá
                </ThemedText>
              </View>
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewStars}>
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Ionicons
                          key={index}
                          name={index < review.rating ? "star" : "star-outline"}
                          size={14}
                          color="#f59e0b"
                        />
                      ))}
                    </View>
                    {review.verified_purchase ? (
                      <ThemedText style={styles.verifiedReview}>
                        Đã mua hàng
                      </ThemedText>
                    ) : null}
                    <ThemedText style={styles.reviewComment}>
                      {review.comment || "Người dùng chưa để lại nhận xét."}
                    </ThemedText>
                  </View>
                ))
              ) : (
                <ThemedText style={styles.emptyReviewText}>
                  Chưa có đánh giá cho sản phẩm này.
                </ThemedText>
              )}
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
          <View
            style={[
              styles.footerFixed,
              { paddingBottom: 12 + Math.max(insets.bottom, 8) },
            ]}
          >
            <TouchableOpacity
              style={styles.chatButton}
              onPress={handleChatWithSeller}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={22}
                color={Colors.light.tint}
              />
            </TouchableOpacity>
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
              disabled={isOutOfStock || flashSaleClaiming}
            >
              <ThemedText style={styles.buyNowText}>
                {flashSaleClaiming
                  ? "Đang giữ suất..."
                  : isFlashSaleAvailable
                    ? "Săn ngay"
                    : "Mua ngay"}
              </ThemedText>
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
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  favoriteButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(230,44,47,0.24)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  favoriteButtonActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  ratingText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "600",
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
  originalPrice: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#9ca3af",
    textDecorationLine: "line-through",
  },
  flashSaleBox: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(230,44,47,0.12)",
    backgroundColor: "#fff7ed",
  },
  flashSaleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  flashSaleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.light.tint,
  },
  flashSaleBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  flashSaleLimitText: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "700",
  },
  flashSalePrice: {
    color: Colors.light.tint,
    fontSize: 20,
    fontWeight: "900",
  },
  flashSaleMeta: {
    marginTop: 4,
    color: "#7c2d12",
    fontSize: 13,
    lineHeight: 18,
  },
  flashSaleError: {
    marginTop: 8,
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
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
    marginBottom: 18,
  },
  reviewSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reviewCountText: {
    fontSize: 12,
    color: "#6b7280",
  },
  reviewCard: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 4,
  },
  verifiedReview: {
    alignSelf: "flex-start",
    fontSize: 11,
    color: "#047857",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 5,
  },
  reviewComment: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },
  emptyReviewText: {
    fontSize: 13,
    color: "#6b7280",
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
  chatButton: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    backgroundColor: "#fff",
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
