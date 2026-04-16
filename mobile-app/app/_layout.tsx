import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox, Platform } from "react-native";
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
    <AuthProvider>
      <CartProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="detail/[id]"
              options={{ headerShown: false, title: "Product Detail" }}
            />
            <Stack.Screen
              name="search/index"
              options={{ headerShown: false, title: "Search" }}
            />
            <Stack.Screen
              name="(auth)/login"
              options={{ headerShown: false, title: "Login" }}
            />
            <Stack.Screen
              name="(auth)/register"
              options={{ headerShown: false, title: "Register" }}
            />
            <Stack.Screen
              name="(auth)/callback"
              options={{ headerShown: false, title: "Auth Callback" }}
            />
            <Stack.Screen
              name="orders/invoice"
              options={{ headerShown: false, title: "Invoice" }}
            />
            <Stack.Screen
              name="orders/addresses"
              options={{ headerShown: false, title: "Manage Addresses" }}
            />
            <Stack.Screen
              name="orders/pending"
              options={{ headerShown: false, title: "Pending Orders" }}
            />
            <Stack.Screen
              name="orders/detail"
              options={{ headerShown: false, title: "Order Detail" }}
            />
            <Stack.Screen
              name="seller/index"
              options={{ headerShown: false, title: "Seller" }}
            />
            <Stack.Screen
              name="seller/products"
              options={{ headerShown: false, title: "Seller Products" }}
            />
            <Stack.Screen
              name="seller/orders"
              options={{ headerShown: false, title: "Seller Orders" }}
            />
            <Stack.Screen
              name="seller/add-product"
              options={{ headerShown: false, title: "Add Product" }}
            />
            <Stack.Screen
              name="seller/edit-product"
              options={{ headerShown: false, title: "Edit Product" }}
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </CartProvider>
    </AuthProvider>
  );
}
