import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

if (Platform.OS === "web") {
  const originalWarn = console.warn.bind(console);

  console.warn = (...args: unknown[]) => {
    const message = args.map((arg) => String(arg)).join(" ");
    if (
      message.includes(
        "props.pointerEvents is deprecated. Use style.pointerEvents",
      ) ||
      message.includes(
        '"textShadow*" style props are deprecated. Use "textShadow".',
      ) ||
      message.includes('"shadow*" style props are deprecated. Use "boxShadow".')
    ) {
      return;
    }

    originalWarn(...args);
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    LogBox.ignoreLogs([
      "props.pointerEvents is deprecated. Use style.pointerEvents",
      '"textShadow*" style props are deprecated. Use "textShadow".',
      '"shadow*" style props are deprecated. Use "boxShadow".',
    ]);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <CartProvider>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="detail/[id]"
                options={{ headerShown: false, title: "Chi tiết sản phẩm" }}
              />
              <Stack.Screen
                name="search/index"
                options={{ headerShown: false, title: "Tìm kiếm" }}
              />
              <Stack.Screen
                name="coupons/index"
                options={{ headerShown: false, title: "Kho coupon" }}
              />
              <Stack.Screen
                name="favourites/index"
                options={{ headerShown: false, title: "Sản phẩm yêu thích" }}
              />
              <Stack.Screen
                name="chat/index"
                options={{ headerShown: false, title: "Trò chuyện" }}
              />
              <Stack.Screen
                name="chat/[id]"
                options={{ headerShown: false, title: "Tin nhắn" }}
              />

              <Stack.Screen
                name="(auth)/login"
                options={{ headerShown: false, title: "Đăng nhập" }}
              />
              <Stack.Screen
                name="(auth)/register"
                options={{ headerShown: false, title: "Đăng ký" }}
              />
              <Stack.Screen
                name="(auth)/forgot-password"
                options={{ headerShown: false, title: "Quên mật khẩu" }}
              />
              <Stack.Screen
                name="(auth)/callback"
                options={{ headerShown: false, title: "Xác thực" }}
              />
              <Stack.Screen
                name="orders/invoice"
                options={{ headerShown: false, title: "Thanh toán" }}
              />
              <Stack.Screen
                name="orders/addresses"
                options={{ headerShown: false, title: "Địa chỉ giao hàng" }}
              />
              <Stack.Screen
                name="orders/pending"
                options={{ headerShown: false, title: "Đơn hàng" }}
              />
              <Stack.Screen
                name="orders/detail"
                options={{ headerShown: false, title: "Chi tiết đơn hàng" }}
              />
              <Stack.Screen
                name="orders/payment"
                options={{ headerShown: false, title: "Thanh toán" }}
              />
              <Stack.Screen
                name="orders/review"
                options={{ headerShown: false, title: "Đánh giá sản phẩm" }}
              />
              <Stack.Screen
                name="seller/index"
                options={{ headerShown: false, title: "Bảng điều khiển" }}
              />
              <Stack.Screen
                name="seller/dashboard"
                options={{ headerShown: false, title: "Bảng điều khiển" }}
              />
              <Stack.Screen
                name="seller/products"
                options={{ headerShown: false, title: "Sản phẩm của tôi" }}
              />
              <Stack.Screen
                name="seller/orders"
                options={{ headerShown: false, title: "Quản lý đơn hàng" }}
              />
              <Stack.Screen
                name="seller/add-product"
                options={{ headerShown: false, title: "Thêm sản phẩm" }}
              />
              <Stack.Screen
                name="seller/edit-product"
                options={{ headerShown: false, title: "Sửa sản phẩm" }}
              />
              <Stack.Screen
                name="seller/coupons"
                options={{ headerShown: false, title: "Quản lý coupon" }}
              />
              <Stack.Screen
                name="seller/add-coupon"
                options={{ headerShown: false, title: "Thêm coupon" }}
              />
              <Stack.Screen
                name="seller/edit-coupon"
                options={{ headerShown: false, title: "Sửa coupon" }}
              />
              <Stack.Screen
                name="seller/settings"
                options={{ headerShown: false, title: "Cài đặt shop" }}
              />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </CartProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
