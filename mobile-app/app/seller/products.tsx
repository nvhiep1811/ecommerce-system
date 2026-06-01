import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmActionModal } from "@/components/ui/confirm-action-modal";
import { productService } from "@/services/productService";
import { Product } from "@/types/product";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ToastBanner from "@/components/ui/toast-banner";
import {
  goToProfile,
  goToSellerDashboard,
  openSellerAddProduct,
  openSellerEditProduct,
  SELLER_DASHBOARD_ROUTE,
  useSellerHardwareBack,
} from "@/utils/sellerNavigation";

export function SellerProductsScreen() {
  const { profile, isLoading: authLoading } = useAuth();
  useSellerHardwareBack(SELLER_DASHBOARD_ROUTE);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [pendingDeleteProductId, setPendingDeleteProductId] = useState<
    number | null
  >(null);
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!profile || profile.role !== "seller") {
      setToast({
        message: "Bạn không có quyền truy cập trang này",
        type: "error",
      });
      goToProfile();
      return;
    }

    const loadProducts = async () => {
      try {
        const data = await productService.getSellerProducts(profile.id);
        const sortedData = data.sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime(),
        );
        setProducts(sortedData);
      } catch (error) {
        setToast({
          message:
            error instanceof Error ? error.message : "Không thể tải sản phẩm",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadProducts();
  }, [authLoading, profile]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (product.description &&
            product.description
              .toLowerCase()
              .includes(searchQuery.toLowerCase())),
      );
      setFilteredProducts(filtered);
    }
  }, [products, searchQuery]);

  const handleDeleteProduct = (productId: number) => {
    setPendingDeleteProductId(productId);
    setDeleteModalVisible(true);
  };

  const handleConfirmDeleteProduct = async () => {
    if (pendingDeleteProductId === null) {
      setDeleteModalVisible(false);
      return;
    }

    try {
      setProducts((prev) =>
        prev.filter((p) => p.id !== pendingDeleteProductId),
      );
      setDeleteModalVisible(false);
      setPendingDeleteProductId(null);
      setToast({ message: "Đã xóa sản phẩm", type: "success" });
    } catch (error) {
      void error;
      setToast({ message: "Không thể xóa sản phẩm", type: "error" });
    }
  };

  const onEdit = React.useCallback((id: number) => {
    openSellerEditProduct(id);
  }, []);

  const onDelete = React.useCallback((id: number) => {
    handleDeleteProduct(id);
  }, []);

  const renderProductItem = React.useCallback(
    ({ item }: { item: Product }) => (
      <View style={styles.productCard}>
        <Image
          source={{ uri: item.thumbnail || undefined }}
          style={styles.productImage}
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.productPrice}>
            {formatCurrencyVnd(item.price)}
          </Text>
          <Text style={styles.productStock}>Tồn kho: {item.stock}</Text>
          <Text style={styles.productRating}>Đánh giá: {item.rating}/5</Text>
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => onEdit(item.id)}
          >
            <Ionicons name="create-outline" size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(item.id)}
          >
            <Ionicons name="trash-outline" size={20} color="red" />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [onEdit, onDelete],
  );

  if (authLoading || loading) {
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
        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={goToSellerDashboard}
            style={styles.headerButton}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Sản phẩm của tôi</Text>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={openSellerAddProduct}
          >
            <Ionicons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#666"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm sản phẩm..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        style={styles.content}
        data={filteredProducts}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id.toString()}
        initialNumToRender={8}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery.trim()
                ? "Không tìm thấy sản phẩm"
                : "Chưa có sản phẩm"}
            </Text>
            {!searchQuery.trim() && (
              <TouchableOpacity
                style={styles.addFirstButton}
                onPress={openSellerAddProduct}
              >
                <Text style={styles.addFirstButtonText}>
                  Thêm sản phẩm đầu tiên
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <ConfirmActionModal
        visible={deleteModalVisible}
        title="Xóa sản phẩm"
        message="Bạn có chắc muốn xóa sản phẩm này?"
        confirmLabel="Xóa"
        destructive
        onConfirm={() => {
          void handleConfirmDeleteProduct();
        }}
        onCancel={() => {
          setDeleteModalVisible(false);
          setPendingDeleteProductId(null);
        }}
      />
      <ToastBanner
        message={toast?.message ?? null}
        type={toast?.type}
        onDismiss={() => setToast(null)}
      />
    </SafeAreaView>
  );
}

export default SellerProductsScreen;

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
  headerButton: {
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
  content: {
    flex: 1,
    padding: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  productCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    elevation: 3,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }),
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 6,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.tint,
    marginBottom: 4,
  },
  productStock: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  productRating: {
    fontSize: 14,
    color: "#666",
  },
  productActions: {
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  editButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  deleteButton: {
    padding: 8,
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
  addFirstButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 1px 2px rgba(0, 0, 0, 0.1)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        }),
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
});
