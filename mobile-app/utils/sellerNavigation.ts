import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { BackHandler, Platform } from "react-native";

export const SELLER_DASHBOARD_ROUTE = "/seller/dashboard";
export const SELLER_PRODUCTS_ROUTE = "/seller/products";
export const SELLER_COUPONS_ROUTE = "/seller/coupons";
export const SELLER_ORDERS_ROUTE = "/seller/orders";
export const SELLER_SETTINGS_ROUTE = "/seller/settings";
export const PROFILE_ROUTE = "/(tabs)/profile";

const replace = (route: string) => {
  router.replace(route as any);
};

const push = (route: string) => {
  router.push(route as any);
};

export const goToSellerDashboard = () => replace(SELLER_DASHBOARD_ROUTE);
export const goToSellerProducts = () => replace(SELLER_PRODUCTS_ROUTE);
export const goToSellerCoupons = () => replace(SELLER_COUPONS_ROUTE);
export const goToSellerOrders = () => replace(SELLER_ORDERS_ROUTE);
export const goToSellerSettings = () => replace(SELLER_SETTINGS_ROUTE);
export const goToProfile = () => replace(PROFILE_ROUTE);

export const openSellerAddProduct = () => push("/seller/add-product");
export const openSellerEditProduct = (id: number) =>
  push(`/seller/edit-product?id=${id}`);
export const openSellerAddCoupon = () => push("/seller/add-coupon");
export const openSellerEditCoupon = (id: number) =>
  push(`/seller/edit-coupon?id=${id}`);
export const openSellerOrderDetail = (orderId: number) =>
  push(`/orders/detail?orderId=${orderId}`);

export const goBackOrReplace = (fallbackRoute: string) => {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  replace(fallbackRoute);
};

export const useSellerHardwareBack = (fallbackRoute: string) => {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") {
        return undefined;
      }

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          replace(fallbackRoute);
          return true;
        },
      );

      return () => subscription.remove();
    }, [fallbackRoute]),
  );
};
