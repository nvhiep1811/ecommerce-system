import { CartItem } from "@/types/cart";
import { productService } from "@/services/productService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: any, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  removeManyFromCart: (productIds: number[]) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  refreshCartProducts: () => Promise<void>;
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
  const cartItemsRef = useRef<CartItem[]>([]);

  useEffect(() => {
    loadCartFromStorage();
  }, []);

  useEffect(() => {
    cartItemsRef.current = cartItems;
  }, [cartItems]);

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

  const removeManyFromCart = (productIds: number[]) => {
    const idsToRemove = new Set(productIds);
    if (idsToRemove.size === 0) {
      return;
    }

    setCartItems((prevItems) => {
      const newItems = prevItems.filter(
        (item) => !idsToRemove.has(item.product.id),
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
        item.product.id === productId
          ? {
              ...item,
              quantity:
                typeof item.product?.stock === "number" && item.product.stock > 0
                  ? Math.min(quantity, item.product.stock)
                  : quantity,
            }
          : item,
      );
      saveCartToStorage(newItems);
      return newItems;
    });
  };

  const refreshCartProducts = useCallback(async () => {
    const currentItems = cartItemsRef.current;
    if (currentItems.length === 0) {
      return;
    }

    const freshItems = await Promise.all(
      currentItems.map(async (item) => {
        try {
          const product = await productService.refreshProductById(
            item.product.id,
          );
          return {
            ...item,
            product,
            quantity:
              product.stock > 0
                ? Math.min(item.quantity, product.stock)
                : item.quantity,
          };
        } catch {
          return item;
        }
      }),
    );
    setCartItems(freshItems);
    await saveCartToStorage(freshItems);
  }, []);

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
        removeManyFromCart,
        updateQuantity,
        refreshCartProducts,
        clearCart,
        getTotalPrice,
        getTotalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
