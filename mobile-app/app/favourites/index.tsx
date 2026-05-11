import ProductCard from "@/components/product-card";
import { Colors } from "@/constants/theme";
import { useCart } from "@/contexts/CartContext";
import { productService } from "@/services/productService";
import { FavouriteItem } from "@/types/product";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FavouritesScreen() {
  const { addToCart } = useCart();
  const [items, setItems] = useState<FavouriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavourites = useCallback(async () => {
    try {
      setLoading(true);
      const nextItems = await productService.getFavourites();
      setItems(nextItems);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFavourites();
    }, [loadFavourites]),
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/profile");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sản phẩm yêu thích</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={[
            styles.listContent,
            items.length === 0 && styles.emptyContent,
          ]}
          renderItem={({ item }) => (
            <ProductCard product={item.product} onAddToCart={addToCart} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="heart-outline" size={58} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Chưa có sản phẩm yêu thích</Text>
              <Text style={styles.emptyText}>
                Nhấn biểu tượng trái tim ở trang sản phẩm để lưu lại món bạn
                quan tâm.
              </Text>
              <TouchableOpacity
                style={styles.exploreButton}
                onPress={() => router.replace("/(tabs)")}
              >
                <Text style={styles.exploreButtonText}>Khám phá sản phẩm</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.light.tint,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 8,
  },
  emptyContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: "#6b7280",
  },
  exploreButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
  },
  exploreButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
