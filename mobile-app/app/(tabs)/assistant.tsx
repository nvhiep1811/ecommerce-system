import { Colors } from "@/constants/theme";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { sendAssistantMessage, SuggestedProduct } from "@/services/assistantApi";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Platform,
  Animated,
  ActivityIndicator,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { productService } from "@/services/productService";

type ChatMessage = {
  id: string;
  text: string;
  from: "buyer" | "seller";
  time: string;
  suggestedProducts?: SuggestedProduct[];
};

const getNowLabel = () =>
  new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 80 : 56;

export default function AssistantChatScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { addToCart } = useCart();
  const resolvedSellerName = "AI Shopping Assistant";
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const conversationId = useMemo(() => {
    return profile?.id ? `user-session-${profile.id}` : `guest-session-${Date.now()}-${Math.random()}`;
  }, [profile?.id]);
  const keyboardPadding = useRef(new Animated.Value(0)).current;
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      from: "seller",
      text: `Xin chào, tôi là trợ lý ảo AI. Tôi có thể giúp bạn tìm kiếm sản phẩm nào hôm nay?`,
      time: getNowLabel(),
    },
  ]);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        from: "seller",
        text: `Xin chào, tôi là trợ lý ảo AI. Tôi có thể giúp bạn tìm kiếm sản phẩm nào hôm nay?`,
        time: getNowLabel(),
      },
    ]);
  }, [profile?.id]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = Keyboard.addListener(showEvent, (e) => {
      const kbHeight = e.endCoordinates.height;
      Animated.timing(keyboardPadding, {
        toValue: kbHeight - TAB_BAR_HEIGHT,
        duration: Platform.OS === "ios" ? e.duration || 250 : 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    });

    const onHide = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardPadding, {
        toValue: 0,
        duration: Platform.OS === "ios" ? 250 : 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [keyboardPadding]);

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    // Animate input down before dismissing keyboard to avoid empty space gap
    Animated.timing(keyboardPadding, {
      toValue: 0,
      duration: Platform.OS === "ios" ? 150 : 100,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start(() => {
      Keyboard.dismiss();
    });

    const newMessage: ChatMessage = {
      id: `${Date.now()}`,
      from: "buyer",
      text,
      time: getNowLabel(),
    };

    setMessages((current) => [...current, newMessage]);
    setDraft("");
    setIsLoading(true);

    try {
      const response = await sendAssistantMessage(text, conversationId);
      
      // Process Actions silently
      if (response.actions && response.actions.length > 0) {
        for (const action of response.actions) {
          if (action.type === "ADD_TO_CART") {
            try {
              const parts = action.targetId.split(":");
              const productId = parseInt(parts[0]);
              const quantity = parts.length > 1 ? parseInt(parts[1]) : 1;
              const product = await productService.getProductById(productId);
              if (product) {
                addToCart(product, quantity);
              }
            } catch (err) {
              console.log("Error processing ADD_TO_CART action:", err);
            }
          }
        }
      }

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now() + 1}`,
          from: "seller",
          text: response.answer,
          time: getNowLabel(),
          suggestedProducts: response.suggestedProducts,
        },
      ]);
    } catch (error) {
      console.error("Failed to send assistant message:", error);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now() + 1}`,
          from: "seller",
          text: "Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau.",
          time: getNowLabel(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageItem = React.useCallback(({ item }: { item: ChatMessage }) => {
    const isBuyer = item.from === "buyer";
    return (
      <>
        <View
          style={[
            styles.messageRow,
            isBuyer ? styles.messageRowBuyer : styles.messageRowSeller,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isBuyer ? styles.buyerBubble : styles.sellerBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isBuyer ? styles.buyerText : styles.sellerText,
              ]}
            >
              {item.text}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isBuyer ? styles.buyerTime : styles.sellerTime,
              ]}
            >
              {item.time}
            </Text>
          </View>
        </View>
        {item.suggestedProducts && item.suggestedProducts.length > 0 && (
          <View style={styles.suggestedListWrapper}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={item.suggestedProducts}
              keyExtractor={(prod) => prod.id.toString()}
              renderItem={({ item: prod }) => (
                <TouchableOpacity
                  style={styles.suggestedCard}
                  onPress={() => router.push(`/detail/${prod.id}`)}
                >
                  <Image
                    source={{
                      uri:
                        prod.thumbnail ||
                        "https://via.placeholder.com/100",
                    }}
                    style={styles.suggestedImage}
                  />
                  <Text style={styles.suggestedName} numberOfLines={2}>
                    {prod.name}
                  </Text>
                  <Text style={styles.suggestedPrice}>
                    {formatCurrencyVnd(prod.price)}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </>
    );
  }, []);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerSide} />
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {resolvedSellerName}
          </Text>
          <Text style={styles.subtitle}>Sẵn sàng hỗ trợ</Text>
        </View>
        <View style={styles.headerSide}>
          <Ionicons name="sparkles-outline" size={24} color="#fff" />
        </View>
      </View>

      <FlatList
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        data={reversedMessages}
        inverted
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={renderMessageItem}
        ListHeaderComponent={
          isLoading ? (
            <View style={[styles.messageRow, styles.messageRowSeller]}>
              <View style={[styles.messageBubble, styles.sellerBubble, { paddingVertical: 8, paddingHorizontal: 12 }]}>
                <Text style={[styles.messageText, styles.sellerText, { fontStyle: "italic", opacity: 0.7 }]}>
                  AI đang suy nghĩ...
                </Text>
              </View>
            </View>
          ) : null
        }
      />

      <Animated.View
        style={[styles.composer, { marginBottom: keyboardPadding }]}
      >
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Hỏi AI trợ lý..."
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!draft.trim() || isLoading) && styles.sendMuted]}
          onPress={handleSend}
          disabled={!draft.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
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
    paddingBottom: 10,
    minHeight: 56,
    backgroundColor: Colors.light.tint,
  },
  headerSide: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    maxWidth: "100%",
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
  },
  messageRow: {
    marginBottom: 10,
    flexDirection: "row",
  },
  messageRowBuyer: {
    justifyContent: "flex-end",
  },
  messageRowSeller: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "78%",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  buyerBubble: {
    backgroundColor: Colors.light.tint,
  },
  sellerBubble: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  buyerText: {
    color: "#fff",
  },
  sellerText: {
    color: "#333",
  },
  messageTime: {
    marginTop: 4,
    fontSize: 11,
    alignSelf: "flex-end",
  },
  buyerTime: {
    color: "rgba(255,255,255,0.8)",
  },
  sellerTime: {
    color: "#999",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#333",
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
  },
  sendMuted: {
    opacity: 0.55,
  },
  suggestedListWrapper: {
    marginBottom: 16,
    paddingLeft: 12,
  },
  suggestedCard: {
    width: 120,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 8,
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  suggestedImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 6,
    backgroundColor: "#f2f2f2",
    marginBottom: 8,
  },
  suggestedName: {
    fontSize: 12,
    color: "#333",
    fontWeight: "600",
    marginBottom: 4,
  },
  suggestedPrice: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: "700",
  },
});
