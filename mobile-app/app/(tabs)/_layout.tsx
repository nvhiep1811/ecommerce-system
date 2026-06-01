import { Tabs } from "expo-router";
import React from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/contexts/AuthContext";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { profile } = useAuth();
  const isSeller = profile?.role === "seller";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:
          colorScheme === "light" ? Colors.light.tint : Colors.dark.tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isSeller ? "Bảng điều khiển" : "Trang chủ",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name={isSeller ? "chart.bar.fill" : "house.fill"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "Tư vấn",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="sparkles" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: isSeller ? "Đơn hàng" : "Giỏ hàng",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name={isSeller ? "shippingbox.fill" : "cart.fill"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
    
  );
}
