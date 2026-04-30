import { CartItem } from "@/types/cart";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  useEffect(() => {
    loadCartFromStorage();
  }, []);

  const loadCartFromStorage = async () => {
    try {
      const cartData = await AsyncStorage.getItem("cart");
      if (cartData) {
        setCartItems(JSON.parse(cartData));
      }
    } catch (error) {
      void error;
    }
  };

  const saveCartToStorage = async (items: CartItem[]) => {
    try {
      await AsyncStorage.setItem("cart", JSON.stringify(items));
    } catch (error) {
      void error;
    }
  };

  const addToCart = (product: any, quantity = 1) => {
    const safeQuantity = Math.max(1, quantity);

    setCartItems((prevItems) => {
      const existingItem = prevItems.find(
        (item) => item.product.id === product.id,
      );
      const stockLimit =
        typeof product?.stock === "number" && product.stock > 0
          ? product.stock
          : undefined;
      let newItems;

      if (existingItem) {
        const nextQuantity = existingItem.quantity + safeQuantity;
        newItems = prevItems.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity:
                  stockLimit !== undefined
                    ? Math.min(stockLimit, nextQuantity)
                    : nextQuantity,
              }
            : item,
        );
      } else {
        const nextQuantity =
          stockLimit !== undefined
            ? Math.min(stockLimit, safeQuantity)
            : safeQuantity;
        newItems = [...prevItems, { product, quantity: nextQuantity }];
      }

      saveCartToStorage(newItems);
      return newItems;
    });
  };

  const removeFromCart = (productId: number) => {
    setCartItems((prevItems) => {
      const newItems = prevItems.filter(
        (item) => item.product.id !== productId,
      );
      saveCartToStorage(newItems);
      return newItems;
    });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCartItems((prevItems) => {
      const newItems = prevItems.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item,
      );
      saveCartToStorage(newItems);
      return newItems;
    });
  };

  const clearCart = () => {
    setCartItems([]);
    saveCartToStorage([]);
  };

  const getTotalPrice = () => {
    return cartItems.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0,
    );
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalPrice,
        getTotalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
