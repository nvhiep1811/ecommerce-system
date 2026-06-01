import ProductCard from "@/components/product-card";
import FlashSaleCard from "@/components/flash-sale-card";
import SlideAnimate from "@/components/slideanimate";
import SellerDashboardScreen from "@/app/seller/dashboard";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { flashSaleService } from "@/services/flashSaleService";
import { productService } from "@/services/productService";
import { FlashSaleItem } from "@/types/flashSale";
import { Product } from "@/types/product";
import { ImageSlider } from "@/types/slide";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PRODUCT_PAGE_SIZE = 10;

interface Category {
  id: number;
  name: string;
}

interface SubCategory {
  id: number;
  name: string;
  category_id: number;
}

function BuyerHome() {
  const { getTotalItems, addToCart } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState<number | null>(
    null,
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [nextProductPage, setNextProductPage] = useState(0);
  const [hasNextProductPage, setHasNextProductPage] = useState(false);
  const [productsLoadingVisible, setProductsLoadingVisible] = useState(false);
  const [flashSaleItems, setFlashSaleItems] = useState<FlashSaleItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const sortOrderRef = useRef<"asc" | "desc">("asc");
  const productsLoadingOpacity = useState(new Animated.Value(0))[0];
  const scrollY = useRef(new Animated.Value(0)).current;
  const productsLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const { profile } = useAuth();

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 110],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const compactSearchOpacity = scrollY.interpolate({
    inputRange: [70, 145],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const compactSearchTranslateY = scrollY.interpolate({
    inputRange: [70, 145],
    outputRange: [-14, 0],
    extrapolate: "clamp",
  });

  useEffect(() => {
    sortOrderRef.current = sortOrder;
  }, [sortOrder]);

  const fetchCategories = useCallback(async () => {
    const cats = await productService.getCategories();
    setCategories(cats);
  }, []);

  const fetchFlashSaleItems = useCallback(async () => {
    try {
      const items = await flashSaleService.getActiveItems(10);
      setFlashSaleItems(items);
    } catch {
      setFlashSaleItems([]);
    }
  }, []);

  const fetchProductPage = useCallback(
    async ({
      categoryId,
      reset,
      page,
      sortDirection,
    }: {
      categoryId?: number | null;
      reset: boolean;
      page?: number;
      sortDirection?: "asc" | "desc";
    }) => {
      if (reset) {
        setProductsLoading(true);
      } else {
        setProductsLoadingMore(true);
      }

      try {
        const result = await productService.getProductsPage({
          category_id: categoryId ?? null,
          page: reset ? 0 : (page ?? 0),
          size: PRODUCT_PAGE_SIZE,
          sort: "price",
          direction: sortDirection ?? sortOrderRef.current,
        });

        setProducts((current) =>
          reset ? result.items : [...current, ...result.items],
        );
        setNextProductPage(result.page + 1);
        setHasNextProductPage(result.has_next);
      } finally {
        if (reset) {
          setProductsLoading(false);
        } else {
          setProductsLoadingMore(false);
        }
      }
    },
    [],
  );

  const fetchSubCategories = useCallback(
    async (categoryId: number) => {
      const subs = await productService.getSubCategoriesByCategory(categoryId);
      setSubCategories(subs);
      if (subs.length > 0) {
        setSelectedSubCategory(subs[0].id);
        await fetchProductPage({ categoryId: subs[0].id, reset: true });
      } else {
        setSelectedSubCategory(null);
        await fetchProductPage({ categoryId, reset: true });
      }
    },
    [fetchProductPage],
  );

  const fetchProducts = useCallback(
    async (subCategoryId: number) => {
      await fetchProductPage({ categoryId: subCategoryId, reset: true });
    },
    [fetchProductPage],
  );

  const fetchProductsByCategory = useCallback(
    async (categoryId: number) => {
      await fetchProductPage({ categoryId, reset: true });
    },
    [fetchProductPage],
  );

  const fetchAllProducts = useCallback(async () => {
    await fetchProductPage({ categoryId: null, reset: true });
  }, [fetchProductPage]);

  const handleSortToggle = useCallback(() => {
    setSortOrder((prev) => {
      const nextOrder = prev === "asc" ? "desc" : "asc";
      void fetchProductPage({
        categoryId: selectedSubCategory ?? selectedCategory,
        reset: true,
        sortDirection: nextOrder,
      });
      return nextOrder;
    });
  }, [fetchProductPage, selectedCategory, selectedSubCategory]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setInitialLoading(true);
        await Promise.all([
          fetchCategories(),
          fetchAllProducts(),
          fetchFlashSaleItems(),
        ]);
      } finally {
        setInitialLoading(false);
      }
    };

    void bootstrap();
  }, [fetchAllProducts, fetchCategories, fetchFlashSaleItems]);



  useEffect(() => {
    if (productsLoadingTimerRef.current) {
      clearTimeout(productsLoadingTimerRef.current);
      productsLoadingTimerRef.current = null;
    }

    if (productsLoading) {
      productsLoadingTimerRef.current = setTimeout(() => {
        setProductsLoadingVisible(true);
        Animated.timing(productsLoadingOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
        productsLoadingTimerRef.current = null;
      }, 140);
      return;
    }

    if (!productsLoadingVisible) {
      return;
    }

    Animated.timing(productsLoadingOpacity, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setProductsLoadingVisible(false);
      }
    });
  }, [productsLoading, productsLoadingOpacity, productsLoadingVisible]);

  useEffect(() => {
    return () => {
      if (productsLoadingTimerRef.current) {
        clearTimeout(productsLoadingTimerRef.current);
      }
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([fetchCategories(), fetchFlashSaleItems()]);

      if (selectedCategory === null) {
        setSubCategories([]);
        setSelectedSubCategory(null);
        await fetchAllProducts();
        return;
      }

      if (selectedSubCategory !== null) {
        await fetchProducts(selectedSubCategory);
        return;
      }

      await fetchProductsByCategory(selectedCategory);
    } finally {
      setRefreshing(false);
    }
  }, [
    selectedCategory,
    selectedSubCategory,
    fetchCategories,
    fetchFlashSaleItems,
    fetchAllProducts,
    fetchProducts,
    fetchProductsByCategory,
  ]);

  const handleLoadMoreProducts = useCallback(() => {
    if (
      initialLoading ||
      refreshing ||
      productsLoading ||
      productsLoadingMore ||
      !hasNextProductPage
    ) {
      return;
    }

    void fetchProductPage({
      categoryId: selectedSubCategory ?? selectedCategory,
      reset: false,
      page: nextProductPage,
    });
  }, [
    fetchProductPage,
    hasNextProductPage,
    initialLoading,
    nextProductPage,
    productsLoading,
    productsLoadingMore,
    refreshing,
    selectedCategory,
    selectedSubCategory,
  ]);

  const renderProductItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard product={item} onAddToCart={addToCart} />
    ),
    [addToCart],
  );

  const handleSearchPress = useCallback(() => {
    router.navigate({
      pathname: "/search",
      params: { focus: "1" },
    });
  }, []);

  const handleFlashSalePress = useCallback((item: FlashSaleItem) => {
    router.push({
      pathname: "/detail/[id]" as any,
      params: {
        id: String(item.product_id),
        flashSaleCampaignId: String(item.campaign_id),
        flashSaleItemId: String(item.item_id),
      },
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setSubCategories([]);
    void fetchAllProducts();
  }, [fetchAllProducts]);

  const handleSelectCategory = useCallback(
    (categoryId: number) => {
      setSelectedCategory(categoryId);
      setSelectedSubCategory(null);
      void fetchSubCategories(categoryId);
    },
    [fetchSubCategories],
  );

  const handleSelectSubCategory = useCallback(
    (subCategoryId: number) => {
      setSelectedSubCategory(subCategoryId);
      void fetchProducts(subCategoryId);
    },
    [fetchProducts],
  );

  const listHeaderComponent = useMemo(
    () => (
      <View>
        <Animated.View style={{ opacity: headerOpacity }}>
          <LinearGradient
            colors={[
              Colors.light.tint,
              Colors.light.tint,
              "rgba(230,44,47,0.15)",
              "#f5f5f5",
            ]}
            locations={[0, 0.72, 0.9, 1]}
            style={styles.headerWrapper}
          >
            <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.deliveryInfo}>
                <Text style={styles.deliveryText}>Giao trong</Text>
                <Text style={styles.deliveryTime}>10 phút</Text>
                <TouchableOpacity>
                  <Text style={styles.deliveryLocation}>
                    Chọn địa chỉ giao hàng
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.headerActions}>
                {profile ? (
                  <TouchableOpacity
                    style={styles.headerIconButton}
                    onPress={() => router.push("/chat" as any)}
                  >
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={24}
                      color={Colors.light.tint}
                    />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => router.replace("/(tabs)/profile")}>
                  <Image
                    source={{
                      uri:
                        profile?.avatar_url || "https://via.placeholder.com/80",
                    }}
                    style={styles.avatar}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.searchBarContainer}>
              <TouchableOpacity
                style={styles.searchContent}
                onPress={handleSearchPress}
              >
                <Ionicons name="search" size={20} color="#888" />
                <Text style={styles.searchPlaceholder}>
                  Tìm kiếm danh mục
                </Text>
              </TouchableOpacity>
              <Ionicons name="mic" size={20} color="#888" />
            </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.slideContainer}>
          <SlideAnimate itemList={ImageSlider} />
        </View>

        {flashSaleItems.length > 0 ? (
          <View style={styles.flashSaleSection}>
            <View style={styles.flashSaleHeader}>
              <View>
                <Text style={styles.flashSaleEyebrow}>Đang diễn ra</Text>
                <Text style={styles.flashSaleTitle}>Flash Sale</Text>
              </View>
              <View style={styles.flashSalePill}>
                <Ionicons name="flash" size={14} color="#fff" />
                <Text style={styles.flashSalePillText}>Săn ngay</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.flashSaleList}
              scrollEventThrottle={16}
            >
              {flashSaleItems.map((item) => (
                <FlashSaleCard
                  key={`${item.campaign_id}-${item.item_id}`}
                  item={item}
                  onPress={handleFlashSalePress}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>Danh mục mua sắm</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          scrollEventThrottle={16}
        >
          <TouchableOpacity
            onPress={handleSelectAll}
            style={[
              styles.categoryItem,
              selectedCategory === null && styles.selectedCategory,
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === null && styles.selectedCategoryText,
              ]}
            >
              Tất cả
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => handleSelectCategory(cat.id)}
              style={[
                styles.categoryItem,
                selectedCategory === cat.id && styles.selectedCategory,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat.id && styles.selectedCategoryText,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {subCategories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.subCategoriesContainer}
            scrollEventThrottle={16}
          >
            {subCategories.map((sub) => (
              <TouchableOpacity
                key={sub.id}
                onPress={() => handleSelectSubCategory(sub.id)}
                style={[
                  styles.subCategoryItem,
                  selectedSubCategory === sub.id && styles.selectedSubCategory,
                ]}
              >
                <Text
                  style={[
                    styles.subCategoryText,
                    selectedSubCategory === sub.id &&
                      styles.selectedSubCategoryText,
                  ]}
                >
                  {sub.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.sectionTitleContainer}>
          <View style={styles.bestsellerHeader}>
            <Text style={styles.sectionTitle}>Sản phẩm nổi bật</Text>
            <TouchableOpacity
              onPress={handleSortToggle}
              style={styles.sortButton}
            >
              <Ionicons
                name="swap-vertical"
                size={20}
                color={Colors.light.tint}
              />
              <Text style={styles.sortText}>
                {sortOrder === "asc"
                  ? "Giá: thấp đến cao"
                  : "Giá: cao đến thấp"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    ),
    [
      categories,
      flashSaleItems,
      handleFlashSalePress,
      handleSearchPress,
      handleSelectAll,
      handleSelectCategory,
      handleSelectSubCategory,
      handleSortToggle,
      headerOpacity,
      profile?.avatar_url,
      selectedCategory,
      selectedSubCategory,
      sortOrder,
      subCategories,
    ],
  );

  return (
    <>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {initialLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
          </View>
        ) : (
          <View style={styles.listArea}>
            <Animated.FlatList
              style={styles.contentScroll}
              data={products}
              renderItem={renderProductItem}
              keyExtractor={(item) => item.id.toString()}
              ListHeaderComponent={listHeaderComponent}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              scrollEventThrottle={16}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: true },
              )}
              initialNumToRender={6}
              windowSize={3}
              removeClippedSubviews={true}
              maxToRenderPerBatch={4}
              updateCellsBatchingPeriod={100}
              onEndReached={handleLoadMoreProducts}
              onEndReachedThreshold={0.45}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={Colors.light.tint}
                />
              }
              ListFooterComponent={
                productsLoadingMore ? (
                  <View style={styles.productsLoadingFooter}>
                    <ActivityIndicator size="small" color={Colors.light.tint} />
                  </View>
                ) : null
              }
            />

            {productsLoadingVisible ? (
              <Animated.View
                style={[
                  styles.productsLoadingOverlay,
                  { opacity: productsLoadingOpacity },
                  { pointerEvents: "none" },
                ]}
              >
                <View style={styles.productsLoadingBarTrack}>
                  <Animated.View
                    style={[
                      styles.productsLoadingBarFill,
                      { opacity: productsLoadingOpacity },
                    ]}
                  />
                </View>
              </Animated.View>
            ) : null}

            <Animated.View
              pointerEvents="box-none"
              style={[
                styles.compactSearchHeader,
                {
                  opacity: compactSearchOpacity,
                  transform: [{ translateY: compactSearchTranslateY }],
                },
              ]}
            >
              <TouchableOpacity
                style={styles.compactSearchBar}
                onPress={handleSearchPress}
              >
                <Ionicons name="search" size={19} color={Colors.light.tint} />
                <Text
                  style={styles.compactSearchText}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  Tìm kiếm danh mục
                </Text>
                <Ionicons name="mic" size={19} color={Colors.light.tint} />
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.replace("/(tabs)/cart")}
          style={styles.cartButtonFixed}
        >
          <Ionicons name="cart-outline" size={28} color="white" />
          {getTotalItems() > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{getTotalItems()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  headerWrapper: {
    paddingBottom: 30,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryText: {
    fontSize: 12,
    color: "white",
  },
  deliveryTime: {
    fontSize: 24,
    fontWeight: "bold",
    marginVertical: 2,
    color: "white",
  },
  deliveryLocation: {
    fontSize: 12,
    color: "white",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(230,44,47,0.22)",
    elevation: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  searchContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  searchPlaceholder: {
    color: "#999",
    fontSize: 14,
    marginLeft: 8,
    lineHeight: 20,
  },
  contentScroll: {
    flex: 1,
  },
  avatar: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    borderWidth: 3,
    borderColor: "#fff",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerIconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.65)",
  },
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  slideContainer: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 22,
  },
  compactSearchHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(230,44,47,0.12)",
  },
  compactSearchBar: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  compactSearchText: {
    flex: 1,
    color: "#777",
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  sectionTitleContainer: {
    paddingHorizontal: 10,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  flashSaleSection: {
    marginHorizontal: 10,
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(230,44,47,0.08)",
  },
  flashSaleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  flashSaleEyebrow: {
    fontSize: 11,
    color: "#b91c1c",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  flashSaleTitle: {
    marginTop: 2,
    fontSize: 20,
    color: "#111827",
    fontWeight: "900",
  },
  flashSalePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.light.tint,
  },
  flashSalePillText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  flashSaleList: {
    paddingLeft: 12,
    paddingRight: 2,
  },
  categoriesContainer: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  categoryItem: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  selectedCategory: {
    backgroundColor: Colors.light.tint,
  },
  categoryText: {
    fontSize: 14,
    color: "#333",
  },
  selectedCategoryText: {
    color: "white",
    fontWeight: "bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listArea: {
    flex: 1,
    position: "relative",
    backgroundColor: "#f5f5f5",
  },
  productsLoadingFooter: {
    paddingVertical: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  productsLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 10,
    elevation: 10,
  },
  productsLoadingBarTrack: {
    flex: 1,
    backgroundColor: "rgba(230,44,47,0.12)",
    overflow: "hidden",
  },
  productsLoadingBarFill: {
    flex: 1,
    backgroundColor: Colors.light.tint,
  },
  subCategoriesContainer: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  subCategoryItem: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: "#e0e0e0",
  },
  selectedSubCategory: {
    backgroundColor: Colors.light.tint,
  },
  subCategoryText: {
    fontSize: 12,
    color: "#666",
  },
  selectedSubCategoryText: {
    color: "white",
    fontWeight: "bold",
  },
  cartButtonFixed: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: Colors.light.tint,
    borderRadius: 50,
    width: 56,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 2px 3px rgba(0, 0, 0, 0.25)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3,
        }),
  },
  cartBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "red",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  cartBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
  },
  bestsellerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
  },
  sortText: {
    fontSize: 12,
    color: Colors.light.tint,
    marginLeft: 4,
    fontWeight: "500",
  },
});

export default function Home() {
  const { profile, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f5f5f5" }}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  if (profile?.role === "seller") {
    return <SellerDashboardScreen />;
  }

  return <BuyerHome />;
}
