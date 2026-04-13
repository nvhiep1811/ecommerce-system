import ProductDetailSkeleton from '@/components/ProductDetailSkeleton';
import Button from '@/components/themed-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { productService } from '@/services/productService';
import { Product } from '@/types/product';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const timeout = (ms: number): Promise<never> =>
  new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), ms));

const requestProductDetails = async (productId: number): Promise<Product> =>
  Promise.race([
    productService.getProductById(productId),
    timeout(10000),
  ]);

export default function ProductDetail() {
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { addToCart, getTotalItems } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    const productId = Number(id);
    if (Number.isNaN(productId)) {
      setError('Invalid product ID');
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
        }
      } catch (fetchError) {
        console.error('Failed to fetch product details:', fetchError);
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load product');
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
      setError('Invalid product ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await requestProductDetails(productId);
      setProduct(data);
    } catch (fetchError) {
      console.error('Failed to fetch product details:', fetchError);
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (product) {
      addToCart(product);
    }
  };

  const handleBuyNow = () => {
    if (user) {
      router.push('/orders/invoicescreen');
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
        <Button title="Retry" onPress={handleRetry} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={26} color="white" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Product Details</ThemedText>
        <TouchableOpacity onPress={() => router.push('/cart')} style={styles.cartButton}>
          <Ionicons name="cart-outline" size={26} color="white" />
          {getTotalItems() > 0 && (
            <View style={styles.cartBadge}>
              <ThemedText style={styles.cartBadgeText}>{getTotalItems()}</ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {product ? (
          <ThemedView style={styles.content}>
            <Image
              source={
                product.thumbnail
                  ? { uri: product.thumbnail }
                  : require('../../assets/images/favicon.png')
              }
              style={styles.productImage}
            />
            <ThemedText style={styles.productName}>{product.name}</ThemedText>
            <ThemedText style={styles.productBrand}>{`by ${product.brand || 'Seller'}`}</ThemedText>

            <View style={styles.priceRow}>
              <ThemedText style={styles.productPrice}>${product.price}</ThemedText>
            </View>

            <ThemedText style={styles.sectionTitle}>Description</ThemedText>
            <ThemedText style={styles.productDescription}>
              {product.description || 'No description available.'}
            </ThemedText>
          </ThemedView>
        ) : (
          <ThemedView style={styles.notFound}>
            <ThemedText style={styles.notFoundText}>Product not found</ThemedText>
            <Button title="Go Back" onPress={() => router.back()} />
          </ThemedView>
        )}
      </ScrollView>

      {product && (
        <View style={styles.footerFixed}>
          <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
            <Ionicons name="cart-outline" size={20} color="white" />
            <ThemedText style={styles.addToCartText}>Add to Cart</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buyNowButton} onPress={handleBuyNow}>
            <ThemedText style={styles.buyNowText}>Buy Now</ThemedText>
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
            <ThemedText style={styles.modalTitle}>You need an account to place an order</ThemedText>
            <ThemedText style={styles.modalMessage}>
              Please sign in or create an account to continue checkout.
            </ThemedText>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.agreeButton}
                onPress={() => {
                  setModalVisible(false);
                  router.push('/loginform/loginscreen');
                }}
              >
                <ThemedText style={styles.agreeText}>Continue</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <ThemedText style={styles.cancelText}>Later</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 18,
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 10,
    backgroundColor: Colors.light.tint,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  cartButton: {
    padding: 8,
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'red',
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
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
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 16,
  },
  productName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  productPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.tint,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
  },
  footerFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    color: 'red',
    fontSize: 18,
    marginBottom: 20,
  },
  addToCartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
  },
  addToCartText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buyNowButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ff6b35',
  },
  buyNowText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    alignItems: 'center',
    borderRadius: 10,
    padding: 20,
    backgroundColor: 'white',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  agreeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    backgroundColor: Colors.light.tint,
  },
  agreeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    backgroundColor: '#ccc',
  },
  cancelText: {
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
