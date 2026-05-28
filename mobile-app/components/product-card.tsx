import { Colors } from "@/constants/theme";
import { Product } from "@/types/product";
import { formatCurrencyVnd } from "@/utils/format";
import { router } from "expo-router";
import React from "react";
import { Image } from "expo-image";
import {
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "./themed-text";

const colorPalette = {
  light: {
    background: "#ffffff",
    border: "#e0e0e0",
    shadow: "#000000",
    text: "#1a1a1a",
    price: "#c0392b",
    addButton: "#1a1a1a",
  },
  dark: {
    background: "#2c3e50",
    border: "#34495e",
    shadow: "#000000",
    text: "#ecf0f1",
    price: "#e74c3c",
    addButton: "#ecf0f1",
  },
};

function ProductCard({
  product,
  onAddToCart,
}: {
  product: Product;
  onAddToCart: (product: Product) => void;
}) {
  const colorScheme = useColorScheme();
  const colors =
    colorScheme === "dark" ? colorPalette.dark : colorPalette.light;
  const isWeb = Platform.OS === "web";
  const scale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.1);
  const shadowOffsetY = useSharedValue(4);
  const shadowRadius = useSharedValue(8);
  const elevation = useSharedValue(5);

  const animatedStyle = useAnimatedStyle(() => {
    if (isWeb) {
      return {
        transform: [{ scale: scale.value }],
        boxShadow: `0px ${shadowOffsetY.value}px ${shadowRadius.value}px rgba(0,0,0,${shadowOpacity.value})`,
      } as any;
    }

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
    shadowOpacity.value = withTiming(0.2, {
      duration: 150,
      easing: Easing.ease,
    });
    shadowOffsetY.value = withTiming(8, { duration: 150, easing: Easing.ease });
    shadowRadius.value = withTiming(6, { duration: 150, easing: Easing.ease });
    elevation.value = withTiming(10, { duration: 150, easing: Easing.ease });
  };

  const onHandlePressOut = () => {
    scale.value = withTiming(1, { duration: 150, easing: Easing.ease });
    shadowOpacity.value = withTiming(0.1, {
      duration: 150,
      easing: Easing.ease,
    });
    shadowOffsetY.value = withTiming(4, { duration: 150, easing: Easing.ease });
    shadowRadius.value = withTiming(8, { duration: 150, easing: Easing.ease });
    elevation.value = withTiming(5, { duration: 150, easing: Easing.ease });
  };

  const formattedPrice = formatCurrencyVnd(product.price);

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        animatedStyle,
        isWeb ? null : { shadowColor: colors.shadow },
      ]}
    >
      <Pressable
        onPress={() => {
          router.push(`/detail/${product.id}`);
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
                : require("../assets/images/favicon.png")
            }
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
            transition={200}
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
            <ThemedText style={styles.productDescription} numberOfLines={2}>
              {product.description || "Xem chi tiết và giá sản phẩm."}
            </ThemedText>
          </View>

          <View style={styles.priceAndButtonContainer}>
            <ThemedText style={[styles.productPrice, { color: colors.price }]}>
              {formattedPrice}
            </ThemedText>

            <Pressable
              onPress={() => onAddToCart(product)}
              style={[
                styles.addButton,
                { backgroundColor: Colors.light.tint },
                { position: "relative" },
              ]}
            >
              <ThemedText
                style={[styles.plusSign, { color: colors.background }]}
              >
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
    width: "50%",
    flexGrow: 0,
    flexShrink: 0,
    padding: 5,
  },
  cardContainer: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
  },
  imageContainer: {
    width: "100%",
    height: 180,
  },
  infoContainer: {
    padding: 12,
    height: 120,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  productDetailsContainer: {
    height: 70,
    overflow: "hidden",
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    color: "#7f8c8d",
    marginBottom: 8,
  },
  priceAndButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productPrice: {
    fontSize: 17,
    fontWeight: "800",
  },
  addButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  plusSign: {
    fontSize: 17,
    top: -2,
  },
});

const areEqual = (
  prev: { product: Product; onAddToCart: (product: Product) => void },
  next: { product: Product; onAddToCart: (product: Product) => void },
) => {
  const a = prev.product;
  const b = next.product;
  return (
    prev.onAddToCart === next.onAddToCart &&
    a.id === b.id &&
    a.price === b.price &&
    a.thumbnail === b.thumbnail &&
    a.stock === b.stock &&
    a.name === b.name &&
    a.description === b.description
  );
};

export default React.memo(ProductCard, areEqual);
