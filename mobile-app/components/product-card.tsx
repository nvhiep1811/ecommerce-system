
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, useColorScheme, View,Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ThemedText } from './themed-text';
import { Product } from '@/types/product';
import { Colors } from '@/constants/theme';


// Biến thể màu sắc cho chế độ sáng và tối
const colorPalette = {
  light: {
    background: '#ffffff',
    border: '#e0e0e0',
    shadow: '#000000',
    text: '#1a1a1a',
    price: '#c0392b',
    addButton: '#1a1a1a', 
  },
  dark: {
    background: '#2c3e50',
    border: '#34495e',
    shadow: '#000000',
    text: '#ecf0f1',
    price: '#e74c3c', 
    addButton: '#ecf0f1', 
  },
};

export default function ProductCard({ product }: { product: Product }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? colorPalette.dark : colorPalette.light;

  // ... (Phần Reanimated và logic onHandlePressIn/Out giữ nguyên) ...
  const scale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.1);
  const shadowOffsetY = useSharedValue(4);
  const shadowRadius = useSharedValue(8);
  const elevation = useSharedValue(5); 

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      shadowOpacity: shadowOpacity.value,
      shadowOffset: { width: 0, height: shadowOffsetY.value },
      shadowRadius: shadowRadius.value,
      elevation: elevation.value,
    };
  });

  const onHandlePressIn = () => {
    scale.value = withTiming(0.97, { duration: 150, easing: Easing.ease });
    shadowOpacity.value = withTiming(0.2, { duration: 150, easing: Easing.ease });
    shadowOffsetY.value = withTiming(8, { duration: 150, easing: Easing.ease });
    shadowRadius.value = withTiming(6, { duration: 150, easing: Easing.ease });
    elevation.value = withTiming(10, { duration: 150, easing: Easing.ease });
  };

  const onHandlePressOut = () => {
    scale.value = withTiming(1, { duration: 150, easing: Easing.ease });
    shadowOpacity.value = withTiming(0.1, { duration: 150, easing: Easing.ease });
    shadowOffsetY.value = withTiming(4, { duration: 150, easing: Easing.ease });
    shadowRadius.value = withTiming(8, { duration: 150, easing: Easing.ease });
    elevation.value = withTiming(5, { duration: 150, easing: Easing.ease });
  };
  
  const handleAddToCart = () => {
    console.log(`Đã thêm sản phẩm ${product.name} vào giỏ hàng!`);
  };

  const formattedPrice = `$${product.price.toLocaleString('en-US')}`;

  return (
    <Animated.View 
        style={[
            styles.cardWrapper, 
            animatedStyle, 
            { 
                shadowColor: colors.shadow, 
            }
        ]}
    >
      <Pressable
        onPress={() => {
          router.navigate(`/detail/${product.id}`);
        }}
        onPressIn={onHandlePressIn}
        onPressOut={onHandlePressOut}
        style={[
          styles.cardContainer,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.imageContainer}>
          <Image
            source={
              product.thumbnail
                ? { uri: product.thumbnail }
                : require('../assets/images/favicon.png')
            }
            style={{ width: '100%', height: '100%' }}
            resizeMode="contain"
          />
        </View>

        <View style={styles.infoContainer}>
            
            <View style={styles.productDetailsContainer}>
                <ThemedText
                style={[styles.productName, { color: colors.text }]}
                numberOfLines={2}
                >
                {product.name}
                </ThemedText>
                <ThemedText
                style={styles.productDescription}
                numberOfLines={2}
                >
                {product.description || 'A Magical New Way To Interact With Your Phone...'} 
                </ThemedText>
            </View>

           
            <View style={styles.priceAndButtonContainer}>
                <ThemedText style={[styles.productPrice, { color: colors.price }]}>
                {formattedPrice}
                </ThemedText>
                
                <Pressable 
                onPress={handleAddToCart}
                style={[styles.addButton, { backgroundColor: Colors.light.tint },{position:"relative"}]}
                >
                <ThemedText style={[
                    styles.plusSign, 
                    { color: colors.background }
                ]}>
                    +
                </ThemedText>
                </Pressable>
            </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    flex: 1,
    padding: 5, 
  },
  cardContainer: {
    flex: 1,
    overflow: 'hidden', 
    borderRadius: 12, 
    borderWidth: 1, 
  },
  imageContainer: {
    width: '100%',
    height: 180, 
  },
  
  // --- Vùng Thông Tin Sản Phẩm Cố Định Kích Thước ---
  infoContainer: {
    padding: 12, 
    // Chiều cao cố định để tất cả thẻ bằng nhau. 
    // (VD: 40px tên + 30px mô tả + 8px margin + 30px giá/nút + 12px padding trên/dưới) 
    height: 120, // Đặt một chiều cao cố định
    justifyContent: 'space-between', // Đẩy giá xuống cuối
    overflow: 'hidden', // Quan trọng: ẩn bất cứ thứ gì vượt quá chiều cao
  },
  
  // Vùng chứa tên và mô tả
  productDetailsContainer: {
    // Chiều cao cố định cho tên và mô tả. 
    // Đảm bảo tổng chiều cao này đủ cho 2 dòng tên + 2 dòng mô tả
    height: 70, 
    overflow: 'hidden',
  },

  productName: {
    fontSize: 15,
    fontWeight: '600', 
    // Không cần minHeight nữa vì đã có productDetailsContainer cố định
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    color: '#7f8c8d', 
    // Không cần minHeight nữa
    marginBottom: 8,
  },
  
  // Giá và nút: Luôn nằm ở cuối (nhờ justifyContent: 'space-between' của infoContainer)
  priceAndButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Bỏ marginTop: 8 vì đã dùng justifyContent: 'space-between'
  },
  
  productPrice: {
    fontSize: 17,
    fontWeight: '800', 
  },
  
  // ... (Phần styles cho nút Add giữ nguyên) ...
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 8, 
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusSign: {
    fontSize: 17, 
    top: -2,
   
  },
});
