import ProductCard from "@/components/product-card";
import { Colors } from "@/constants/theme";
import { useCart } from "@/contexts/CartContext";
import { productService } from "@/services/productService";
import { Product } from "@/types/product";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

const SEARCH_HISTORY_KEY = "mobile_search_history_v1";
const SEARCH_DEBOUNCE_MS = 350;
const MIN_SEARCH_LENGTH = 2;
const MAX_HISTORY_ITEMS = 12;
const HISTORY_PREVIEW_COUNT = 5;
const SEARCH_PAGE_SIZE = 10;

const normalizeQuery = (value: string) => value.trim().replace(/\s+/g, " ");

export default function SearchScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const { addToCart } = useCart();
  const { focus, q } = useLocalSearchParams<{ focus?: string; q?: string }>();
  const inputRef = useRef<TextInput>(null);
  const requestSeqRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);

  const trimmedQuery = useMemo(
    () => normalizeQuery(searchQuery),
    [searchQuery],
  );
  const showHistory = trimmedQuery.length === 0 && searchHistory.length > 0;
  const visibleHistory = useMemo(
    () =>
      showAllHistory
        ? searchHistory
        : searchHistory.slice(0, HISTORY_PREVIEW_COUNT),
    [searchHistory, showAllHistory],
  );

  useEffect(() => {
    const initialQuery = Array.isArray(q) ? q[0] : q;
    if (initialQuery) {
      setSearchQuery(initialQuery);
    }
  }, [q]);

  useEffect(() => {
    const shouldFocus = Array.isArray(focus) ? focus[0] === "1" : focus === "1";
    if (!shouldFocus) {
      return;
    }

    const focusTimer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(focusTimer);
  }, [focus]);

  const persistHistory = useCallback(async (items: string[]) => {
    try {
      await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
    } catch {
      // History is a convenience feature; search should keep working.
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
      if (!raw || !mountedRef.current) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSearchHistory(
          parsed
            .filter((item): item is string => typeof item === "string")
            .map(normalizeQuery)
            .filter(Boolean)
            .slice(0, MAX_HISTORY_ITEMS),
        );
      }
    } catch {
      if (mountedRef.current) {
        setSearchHistory([]);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadHistory();

    return () => {
      mountedRef.current = false;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [loadHistory]);

  const addHistoryItem = useCallback(
    (query: string) => {
      const normalized = normalizeQuery(query);
      if (!normalized) {
        return;
      }

      setSearchHistory((current) => {
        const next = [
          normalized,
          ...current.filter(
            (item) => item.toLowerCase() !== normalized.toLowerCase(),
          ),
        ].slice(0, MAX_HISTORY_ITEMS);
        void persistHistory(next);
        return next;
      });
    },
    [persistHistory],
  );

  const removeHistoryItem = useCallback(
    (query: string) => {
      setSearchHistory((current) => {
        const next = current.filter((item) => item !== query);
        void persistHistory(next);
        return next;
      });
    },
    [persistHistory],
  );

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    setShowAllHistory(false);
    void AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
  }, []);

  const executeSearch = useCallback(
    async (
      query: string,
      options?: { saveHistory?: boolean; page?: number; append?: boolean },
    ) => {
      const normalized = normalizeQuery(query);
      const requestId = requestSeqRef.current + 1;
      requestSeqRef.current = requestId;
      const page = options?.page ?? 0;
      const append = Boolean(options?.append);

      if (normalized.length < MIN_SEARCH_LENGTH) {
        setProducts([]);
        setLoading(false);
        setLoadingMore(false);
        setSearchError("");
        setHasSearched(false);
        setNextPage(0);
        setHasNextPage(false);
        return;
      }

      if (options?.saveHistory) {
        addHistoryItem(normalized);
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setSearchError("");

      try {
        const result = await productService.searchProductsPage(
          normalized,
          page,
          SEARCH_PAGE_SIZE,
        );
        if (requestSeqRef.current !== requestId || !mountedRef.current) {
          return;
        }
        setProducts((current) =>
          append ? [...current, ...result.items] : result.items,
        );
        setHasSearched(true);
        setNextPage(result.page + 1);
        setHasNextPage(result.has_next);
      } catch (error) {
        if (requestSeqRef.current !== requestId || !mountedRef.current) {
          return;
        }
        if (!append) {
          setProducts([]);
          setNextPage(0);
          setHasNextPage(false);
        }
        setSearchError(
          error instanceof Error
            ? error.message
            : "Không thể tìm kiếm sản phẩm. Vui lòng thử lại.",
        );
        setHasSearched(true);
      } finally {
        if (requestSeqRef.current === requestId && mountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [addHistoryItem],
  );

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (trimmedQuery.length === 0) {
      requestSeqRef.current += 1;
      setProducts([]);
      setLoading(false);
      setLoadingMore(false);
      setSearchError("");
      setHasSearched(false);
      setNextPage(0);
      setHasNextPage(false);
      return;
    }

    if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
      requestSeqRef.current += 1;
      setProducts([]);
      setLoading(false);
      setLoadingMore(false);
      setSearchError("");
      setHasSearched(false);
      setNextPage(0);
      setHasNextPage(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void executeSearch(trimmedQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [executeSearch, trimmedQuery]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)");
  }, []);

  const commitSearch = useCallback(() => {
    Keyboard.dismiss();
    void executeSearch(searchQuery, { saveHistory: true });
  }, [executeSearch, searchQuery]);

  const selectHistoryItem = useCallback(
    (query: string) => {
      setSearchQuery(query);
      Keyboard.dismiss();
      void executeSearch(query, { saveHistory: true });
    },
    [executeSearch],
  );

  const clearQuery = useCallback(() => {
    requestSeqRef.current += 1;
    setSearchQuery("");
    setProducts([]);
    setLoading(false);
    setLoadingMore(false);
    setSearchError("");
    setHasSearched(false);
    setNextPage(0);
    setHasNextPage(false);
    inputRef.current?.focus();
  }, []);

  const loadMoreResults = useCallback(() => {
    if (
      loading ||
      loadingMore ||
      !hasNextPage ||
      trimmedQuery.length < MIN_SEARCH_LENGTH
    ) {
      return;
    }

    void executeSearch(trimmedQuery, {
      page: nextPage,
      append: true,
    });
  }, [
    executeSearch,
    hasNextPage,
    loading,
    loadingMore,
    nextPage,
    trimmedQuery,
  ]);

  const renderProductItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductCard product={item} onAddToCart={addToCart} />
    ),
    [addToCart],
  );

  const renderHistory = useMemo(() => {
    if (!showHistory) {
      return null;
    }

    return (
      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Tìm kiếm gần đây</Text>
          <TouchableOpacity onPress={clearHistory} hitSlop={8}>
            <Text style={styles.clearHistoryText}>Xóa tất cả</Text>
          </TouchableOpacity>
        </View>

        {visibleHistory.map((item) => (
          <TouchableOpacity
            key={item}
            style={styles.historyItem}
            onPress={() => selectHistoryItem(item)}
          >
            <Ionicons name="time-outline" size={17} color="#7a7a7a" />
            <Text style={styles.historyText} numberOfLines={1}>
              {item}
            </Text>
            <TouchableOpacity
              onPress={() => removeHistoryItem(item)}
              hitSlop={10}
              style={styles.removeHistoryButton}
            >
              <Ionicons name="close" size={18} color="#9a9a9a" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {searchHistory.length > HISTORY_PREVIEW_COUNT ? (
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => setShowAllHistory((current) => !current)}
          >
            <Text style={styles.showMoreText}>
              {showAllHistory ? "Thu gọn" : "Xem thêm"}
            </Text>
            <Ionicons
              name={showAllHistory ? "chevron-up" : "chevron-down"}
              size={16}
              color={Colors.light.tint}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }, [
    clearHistory,
    removeHistoryItem,
    searchHistory.length,
    selectHistoryItem,
    showAllHistory,
    showHistory,
    visibleHistory,
  ]);

  const emptyMessage = useMemo(() => {
    if (trimmedQuery.length === 0) {
      return "Nhập từ khóa để tìm sản phẩm.";
    }

    if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
      return "Nhập ít nhất 2 ký tự để bắt đầu tìm kiếm.";
    }

    if (searchError) {
      return searchError;
    }

    if (hasSearched) {
      return `Không tìm thấy sản phẩm cho "${trimmedQuery}".`;
    }

    return "Đang chuẩn bị kết quả tìm kiếm...";
  }, [hasSearched, searchError, trimmedQuery]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.tint} />
        </TouchableOpacity>

        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            ref={inputRef}
            style={[
              styles.searchInput,
              {
                color:
                  colorScheme === "dark" ? Colors.dark.tint : Colors.light.tint,
              },
            ]}
            placeholder="Tìm sản phẩm..."
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={commitSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="never"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={clearQuery} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color="#aaa" />
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={[
            styles.searchIconButton,
            trimmedQuery.length < MIN_SEARCH_LENGTH && styles.searchButtonMuted,
          ]}
          onPress={commitSearch}
          disabled={trimmedQuery.length < MIN_SEARCH_LENGTH}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Ionicons name="search" size={22} color="white" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        style={styles.contentScroll}
        contentContainerStyle={styles.listContent}
        data={products}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={100}
        windowSize={3}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
        ListHeaderComponent={renderHistory}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color={Colors.light.tint} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={Colors.light.tint} />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text
                style={[
                  styles.emptyText,
                  searchError ? styles.errorText : undefined,
                ]}
              >
                {emptyMessage}
              </Text>
            </View>
          )
        }
        onEndReached={loadMoreResults}
        onEndReachedThreshold={0.45}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    minHeight: 56,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    height: 42,
    marginRight: 10,
    justifyContent: "space-between",
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.light.tint,
  },
  searchIconButton: {
    width: 42,
    height: 42,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  searchButtonMuted: {
    opacity: 0.55,
  },
  backButton: {
    width: 40,
    height: 42,
    marginRight: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    fontSize: 16,
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  contentScroll: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
    flexGrow: 1,
  },
  historyContainer: {
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  clearHistoryText: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: "600",
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f6f6f6",
  },
  historyText: {
    fontSize: 15,
    color: "#333",
    marginLeft: 10,
    flex: 1,
  },
  removeHistoryButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  showMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  showMoreText: {
    fontSize: 14,
    color: Colors.light.tint,
    fontWeight: "600",
    marginRight: 5,
  },
  footerLoading: {
    paddingVertical: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  emptyText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  errorText: {
    color: "#c2410c",
  },
});
