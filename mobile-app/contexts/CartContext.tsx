import { CartItem } from "@/types/cart";
import { productService } from "@/services/productService";
import { ProductVariant } from "@/types/product";
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
  addToCart: (product: any, quantity?: number, variant?: ProductVariant | null) => void;
  removeFromCart: (productId: number, variantId?: number | null) => void;
  removeManyFromCart: (keys: Array<{ productId: number; variantId?: number | null }>) => void;
  updateQuantity: (productId: number, quantity: number, variantId?: number | null) => void;
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

const cartLineKey = (productId: number, variantId?: number | null) =>
  `${productId}:${variantId ?? "default"}`;

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

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveCartToStorage = (items: CartItem[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem("cart", JSON.stringify(items)).catch(() => {});
    }, 500);
  };

  const addToCart = (product: any, quantity = 1, variant?: ProductVariant | null) => {
    const safeQuantity = Math.max(1, quantity);
    const variantId = variant?.id ?? null;

    setCartItems((prevItems) => {
      const existingItem = prevItems.find(
        (item) =>
          cartLineKey(item.product.id, item.variant?.id) ===
          cartLineKey(product.id, variantId),
      );
      const stockLimit =
        typeof variant?.stock === "number" && variant.stock > 0
          ? variant.stock
          : typeof product?.stock === "number" && product.stock > 0
          ? product.stock
          : undefined;
      let newItems;

      if (existingItem) {
        const nextQuantity = existingItem.quantity + safeQuantity;
        newItems = prevItems.map((item) =>
          cartLineKey(item.product.id, item.variant?.id) ===
          cartLineKey(product.id, variantId)
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
        newItems = [...prevItems, { product, variant: variant ?? null, quantity: nextQuantity }];
      }

      saveCartToStorage(newItems);
      return newItems;
    });
  };

  const removeFromCart = (productId: number, variantId?: number | null) => {
    setCartItems((prevItems) => {
      const newItems = prevItems.filter(
        (item) => cartLineKey(item.product.id, item.variant?.id) !== cartLineKey(productId, variantId),
      );
      saveCartToStorage(newItems);
      return newItems;
    });
  };

  const removeManyFromCart = (keys: Array<{ productId: number; variantId?: number | null }>) => {
    const keysToRemove = new Set(keys.map((key) => cartLineKey(key.productId, key.variantId)));
    if (keysToRemove.size === 0) {
      return;
    }

    setCartItems((prevItems) => {
      const newItems = prevItems.filter(
        (item) => !keysToRemove.has(cartLineKey(item.product.id, item.variant?.id)),
      );
      saveCartToStorage(newItems);
      return newItems;
    });
  };

  const updateQuantity = (productId: number, quantity: number, variantId?: number | null) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }

    setCartItems((prevItems) => {
      const newItems = prevItems.map((item) =>
        cartLineKey(item.product.id, item.variant?.id) === cartLineKey(productId, variantId)
          ? {
              ...item,
              quantity:
                typeof item.variant?.stock === "number" && item.variant.stock > 0
                  ? Math.min(quantity, item.variant.stock)
                  : typeof item.product?.stock === "number" && item.product.stock > 0
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
          const freshVariant =
            item.variant?.id == null
              ? null
              : product.variants?.find((variant) => variant.id === item.variant?.id) ?? item.variant;
          const stockLimit = freshVariant?.stock ?? product.stock;
          return {
            ...item,
            product,
            variant: freshVariant,
            quantity:
              stockLimit > 0
                ? Math.min(item.quantity, stockLimit)
                : item.quantity,
          };
        } catch {
          return item;
        }
      }),
    );
    setCartItems(freshItems);
    saveCartToStorage(freshItems);
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
