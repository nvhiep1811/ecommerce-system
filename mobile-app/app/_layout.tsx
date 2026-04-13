import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <CartProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            <Stack.Screen name="detail/[id]" options={{ headerShown: false, title: 'Detail' }} />
            <Stack.Screen name="search/search" options={{ headerShown: false, title: 'Search' }} />
            <Stack.Screen name="loginform/loginscreen" options={{ headerShown: false, title: 'LoginForm' }} />
            <Stack.Screen name="orders/invoicescreen" options={{ headerShown: false, title: 'Invoice' }} />
            <Stack.Screen name="orders/pendingorders" options={{ headerShown: false, title: 'Pending Orders' }} />
            <Stack.Screen name="orders/orderdetail" options={{ headerShown: false, title: 'Order Detail' }} />
            <Stack.Screen name="loginform/signupscreen" options={{ headerShown: false, title: 'Sign Up' }} />
            <Stack.Screen name="seller/products" options={{ headerShown: false, title: 'Seller Products' }} />
            <Stack.Screen name="seller/orders" options={{ headerShown: false, title: 'Seller Orders' }} />
            <Stack.Screen name="seller/add-product" options={{ headerShown: false, title: 'Add Product' }} />
            <Stack.Screen name="seller/edit-product" options={{ headerShown: false, title: 'Edit Product' }} />
           </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </CartProvider>
    </AuthProvider>
  );
}
