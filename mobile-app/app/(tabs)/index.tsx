import ProductCard from '@/components/product-card';
import SlideAnimate from '@/components/slideanimate';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { productService } from '@/services/productService';
import { Product } from '@/types/product';
import { ImageSlider } from '@/types/slide';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  LogBox,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Category {
  id: number;
  name: string;
}

interface SubCategory {
  id: number;
  name: string;
  category_id: number;
}


if (__DEV__) {
  LogBox.ignoreLogs([
    'Text strings must be rendered within a <Text> component',
  ]);
}

// Bắt lỗi toàn cục và bỏ qua riêng lỗi này
const defaultHandler = ErrorUtils.getGlobalHandler();

ErrorUtils.setGlobalHandler((error, isFatal) => {
  if (
    error?.message?.includes('Text strings must be rendered within a <Text> component')
  ) {
    console.warn('⚠️ Ignored text render error');
    return; // Ngừng xử lý lỗi này
  }
  // Các lỗi khác vẫn xử lý như bình thường
  defaultHandler(error, isFatal);
});

export default function Home() {
  const { getTotalItems } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const scrollY = useState(new Animated.Value(0))[0];
   const { profile } = useAuth();
  

  const fetchCategories = async () => {
    const cats = await productService.getCategories();
    setCategories(cats);
  };

  const fetchSubCategories = async (categoryId: number) => {
    const subs = await productService.getSubCategoriesByCategory(categoryId);
    setSubCategories(subs);
    if (subs.length > 0) {
      setSelectedSubCategory(subs[0].id);
      fetchProducts(subs[0].id);
    } else {
      fetchProductsByCategory(categoryId);
    }
  };

  const fetchProducts = async (subCategoryId: number) => {
    setLoading(true);
    const prods = await productService.getProductsBySubCategory(subCategoryId);
    const sortedProds = [...prods].sort((a, b) => sortOrder === 'asc' ? a.price - b.price : b.price - a.price);
    setProducts(sortedProds);
    setLoading(false);
  };

  const fetchProductsByCategory = async (categoryId: number) => {
    setLoading(true);
    const prods = await productService.getProductsByCategory(categoryId);
    const sortedProds = [...prods].sort((a, b) => sortOrder === 'asc' ? a.price - b.price : b.price - a.price);
    setProducts(sortedProds);
    setLoading(false);
  };

  const fetchAllProducts = async () => {
    setLoading(true);
    const prods = await productService.getProducts();
    // Sort by created_at descending to show newest products first
    const sortedProds = [...prods].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // Newest first
    });
    setProducts(sortedProds);
    setLoading(false);
  };

  const handleSortToggle = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    // Re-sort current products
    setProducts(prev => [...prev].sort((a, b) => sortOrder === 'asc' ? a.price - b.price : b.price - a.price));
  };

  useEffect(() => {
    fetchCategories();
    fetchAllProducts();
  }, []);

  const headerBgColor = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [Colors.light.tint, '#ffffff'],
    extrapolate: 'clamp',
  });

  const headerTextColor = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: ['#ffffff', Colors.light.tint],
    extrapolate: 'clamp',
  });

  const renderProductItem = ({ item }: { item: Product }) => (
    <ProductCard product={item} />
  );

  const renderListHeader = () => (
    <View>
      <View style={styles.slideContainer}>
        <SlideAnimate itemList={ImageSlider} />
      </View>

      <View style={styles.sectionTitleContainer}>
        <Text style={styles.sectionTitle}>Grocery & Kitchen</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        scrollEventThrottle={16}
      >
        <TouchableOpacity
          onPress={() => {
            setSelectedCategory(null);
            setSelectedSubCategory(null);
            fetchAllProducts();
          }}
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
            All
          </Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => {
              setSelectedCategory(cat.id);
              setSelectedSubCategory(null);
              fetchSubCategories(cat.id);
            }}
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
              onPress={() => {
                setSelectedSubCategory(sub.id);
                fetchProducts(sub.id);
              }}
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
          <Text style={styles.sectionTitle}>Bestsellers</Text>
          <TouchableOpacity onPress={handleSortToggle} style={styles.sortButton}>
            <Ionicons name="swap-vertical" size={20} color={Colors.light.tint} />
            <Text style={styles.sortText}>
              {sortOrder === 'asc' ? 'Price: Low to High' : 'Price: High to Low'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <>
      <SafeAreaView style={styles.container}>
        <Animated.View
          style={[styles.headerWrapper, { backgroundColor: headerBgColor }]}
        >
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.deliveryInfo}>
                <Animated.Text
                  style={[styles.deliveryText, { color: headerTextColor }]}
                >
                  Delivery in
                </Animated.Text>
                <Animated.Text
                  style={[styles.deliveryTime, { color: headerTextColor }]}
                >
                  10 minutes
                </Animated.Text>
                <TouchableOpacity>
                  <Animated.Text
                    style={[styles.deliveryLocation, { color: headerTextColor }]}
                  >
                    Knowhere, Somewhere...
                  </Animated.Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity>
                <Animated.View style={{ opacity: 1 }}>
                  <Image
                    source={{ uri: profile?.avatar_url || 'https://via.placeholder.com/80' }}
                    style={styles.avatar}
                  />
                </Animated.View>
              </TouchableOpacity>
            </View>

            <Animated.View
              style={[
                styles.searchBarContainer,
                {
                  borderColor: headerTextColor,
                  borderWidth: 1,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.searchContent}
                onPress={() => router.push('/search/search')}
              >
                <Ionicons name="search" size={20} color="#888" />
                <Text style={styles.searchPlaceholder}>
                  Search for ata, dal, coke
                </Text>
              </TouchableOpacity>
              <Ionicons name="mic" size={20} color="#888" />
            </Animated.View>
          </View>
          {/* Fade Overlay ở dưới header */}
          <LinearGradient
            colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.headerFadeOverlay}
            pointerEvents="none"
          />
        </Animated.View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.tint} />
          </View>
        ) : (
          <FlatList
            style={styles.contentScroll}
            data={products}
            renderItem={renderProductItem}
            keyExtractor={(item) => item.id.toString()}
            ListHeaderComponent={renderListHeader}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            scrollEventThrottle={16}
            removeClippedSubviews={true}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
          />
        )}

        <TouchableOpacity
          onPress={() => router.push('/cart')}
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
    backgroundColor: 'white',
  },
  flatListWrapper: {
    flex: 1,
    position: 'relative',
  },
  headerWrapper: {
    paddingBottom: 20,
    position: 'relative',
  },
  headerFadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  headerGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deliveryInfo: {
    flex: 1,
  },
  deliveryText: {
    fontSize: 12,
  },
  deliveryTime: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 2,
  },
  deliveryLocation: {
    fontSize: 12,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
  },
  searchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  searchPlaceholder: {
    color: '#999',
    fontSize: 14,
    marginLeft: 8,
  },
  contentScroll: {
    flex: 1,
  },
  avatar: {
    width: 65, // Nhỏ lại một chút
    height: 65,
    borderRadius: 32.5 ,
    borderWidth: 2,
    borderColor: '#fff',
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  slideContainer: {
    height: 200,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    paddingHorizontal: 10,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
    backgroundColor: '#f0f0f0',
  },
  selectedCategory: {
    backgroundColor: Colors.light.tint,
  },
  categoryText: {
    fontSize: 14,
    color: '#333',
  },
  selectedCategoryText: {
    color: 'white',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#e0e0e0',
  },
  selectedSubCategory: {
    backgroundColor: Colors.light.tint,
  },
  subCategoryText: {
    fontSize: 12,
    color: '#666',
  },
  selectedSubCategoryText: {
    color: 'white',
    fontWeight: 'bold',
  },
  fadeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
    zIndex: 10,
  },
  cartButtonFixed: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: Colors.light.tint,
    borderRadius: 50,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'red',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bestsellerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  sortText: {
    fontSize: 12,
    color: Colors.light.tint,
    marginLeft: 4,
    fontWeight: '500',
  },
});
