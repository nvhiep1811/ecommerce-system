import React from "react";
import { StyleSheet, View } from "react-native";
import { ThemedView } from "./themed-view";
import { Colors } from "@/constants/theme";

export default function ProductDetailSkeleton() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backButtonSkeleton} />
        <View style={styles.headerTitleSkeleton} />
        <View style={styles.cartButtonSkeleton} />
      </View>

      <View style={styles.scrollView}>
        <ThemedView style={styles.content}>
          <View style={styles.imageSkeleton} />

          <View style={styles.nameSkeleton} />
          <View style={styles.priceSkeleton} />
          <View style={styles.ratingSkeleton} />
          <View style={styles.brandSkeleton} />
          <View style={styles.stockSkeleton} />

          <View style={styles.descriptionSkeleton} />
          <View style={styles.descriptionSkeleton} />
          <View style={styles.descriptionSkeleton} />
        </ThemedView>
      </View>

      <View style={styles.footer}>
        <View style={styles.addToCartSkeleton} />
        <View style={styles.buyNowSkeleton} />
      </View>
    </ThemedView>
  );
}

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
    paddingVertical: 12,
    backgroundColor: Colors.light.tint,
    paddingTop: 10,
  },
  backButtonSkeleton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 20,
  },
  headerTitleSkeleton: {
    width: 150,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 4,
  },
  cartButtonSkeleton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 20,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  imageSkeleton: {
    width: "100%",
    height: 300,
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
    marginBottom: 16,
  },
  nameSkeleton: {
    height: 28,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 8,
  },
  priceSkeleton: {
    height: 32,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 8,
    width: "60%",
  },
  ratingSkeleton: {
    height: 20,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 4,
    width: "40%",
  },
  brandSkeleton: {
    height: 20,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 4,
    width: "50%",
  },
  stockSkeleton: {
    height: 20,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 16,
    width: "45%",
  },
  descriptionSkeleton: {
    height: 18,
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  addToCartSkeleton: {
    flex: 1,
    height: 48,
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
  },
  buyNowSkeleton: {
    flex: 1,
    height: 48,
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
  },
});
