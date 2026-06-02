import { Colors } from "@/constants/theme";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-native-markdown-display";
import { SuggestedProduct } from "@/services/assistantApi";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import type { KeyboardEvent } from "react-native";
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
  isStreaming?: boolean;
};

const getNowLabel = () =>
  new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

const markdownStyles = {
  body: {
    color: "#333",
    fontSize: 15,
    lineHeight: 22,
  },
  strong: {
    fontWeight: "bold",
  },
  paragraph: {
    marginVertical: 4,
  },
  list_item: {
    marginVertical: 2,
  },
} as any;

export default function AssistantChatScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { addToCart } = useCart();
  const resolvedSellerName = "AI Shopping Assistant";
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const conversationId = useMemo(() => {
    return profile?.id
      ? `user-session-${profile.id}`
      : `guest-session-${Date.now()}-${Math.random()}`;
  }, [profile?.id]);

  const bottomInset = Math.max(
    insets.bottom,
    Platform.OS === "android" ? 28 : 8,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      from: "seller",
      text: `Xin chào, tôi là trợ lý ảo AI. Tôi có thể giúp bạn tìm kiếm sản phẩm nào hôm nay?`,
      time: getNowLabel(),
    },
  ]);
  const streamQueue = useRef<string[]>([]);
  const streamTimer = useRef<any>(null);
  const botMessageText = useRef<string>("");
  const checkDoneTimer = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (streamTimer.current) clearInterval(streamTimer.current);
      if (checkDoneTimer.current) clearInterval(checkDoneTimer.current);
    };
  }, []);

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

  const isGenerating = isLoading || messages.some((m) => m.isStreaming);

  const handleSend = async (customText?: string) => {
    const text = (typeof customText === "string" ? customText : draft).trim();
    if (!text) {
      return;
    }

    Keyboard.dismiss();

    const newMessage: ChatMessage = {
      id: `${Date.now()}`,
      from: "buyer",
      text,
      time: getNowLabel(),
    };

    const botMessageId = `${Date.now() + 1}`;
    const newBotMessage: ChatMessage = {
      id: botMessageId,
      from: "seller",
      text: "",
      time: getNowLabel(),
      isStreaming: true,
    };

    setMessages((current) => [...current, newMessage, newBotMessage]);
    setDraft("");
    setIsLoading(true);

    // Reset stream state
    streamQueue.current = [];
    botMessageText.current = "";
    if (streamTimer.current) {
      clearInterval(streamTimer.current);
      streamTimer.current = null;
    }
    if (checkDoneTimer.current) {
      clearInterval(checkDoneTimer.current);
      checkDoneTimer.current = null;
    }

    import("@/services/assistantApi").then(({ sendAssistantMessageStream }) => {
      sendAssistantMessageStream(
        text,
        conversationId,
        (textChunk) => {
          setIsLoading(false);

          // Clear temporary tool-calling status message when the actual response starts arriving
          const isStatus = textChunk.startsWith("⏳");
          if (
            !isStatus &&
            (botMessageText.current.startsWith("⏳") ||
              streamQueue.current.includes("⏳"))
          ) {
            streamQueue.current = [];
            botMessageText.current = "";
          }

          // Split chunk into characters to make typewriter animation fluid
          const chars = textChunk.split("");
          streamQueue.current.push(...chars);

          if (!streamTimer.current) {
            streamTimer.current = setInterval(() => {
              if (streamQueue.current.length > 0) {
                // Dynamically adjust characters printed based on backlog to keep up smoothly
                const backlog = streamQueue.current.length;
                let charsToPop = 1;
                if (backlog > 40) {
                  charsToPop = 6;
                } else if (backlog > 20) {
                  charsToPop = 3;
                } else if (backlog > 8) {
                  charsToPop = 2;
                }

                let nextChars = "";
                for (let i = 0; i < charsToPop; i++) {
                  if (streamQueue.current.length > 0) {
                    nextChars += streamQueue.current.shift();
                  }
                }

                botMessageText.current += nextChars;
                setMessages((current) =>
                  current.map((m) =>
                    m.id === botMessageId
                      ? { ...m, text: botMessageText.current }
                      : m,
                  ),
                );
              }
            }, 20);
          }
        },
        (suggestedProducts, actions) => {
          setIsLoading(false);

          // Poll until the queue is completely drained before stopping streaming mode
          checkDoneTimer.current = setInterval(() => {
            if (streamQueue.current.length === 0) {
              if (checkDoneTimer.current) {
                clearInterval(checkDoneTimer.current);
                checkDoneTimer.current = null;
              }
              if (streamTimer.current) {
                clearInterval(streamTimer.current);
                streamTimer.current = null;
              }

              setMessages((current) =>
                current.map((m) =>
                  m.id === botMessageId
                    ? {
                        ...m,
                        text: botMessageText.current,
                        isStreaming: false,
                        suggestedProducts:
                          suggestedProducts && suggestedProducts.length > 0
                            ? suggestedProducts
                            : m.suggestedProducts,
                      }
                    : m,
                ),
              );

              if (actions && actions.length > 0) {
                for (const action of actions) {
                  if (action.type === "ADD_TO_CART") {
                    try {
                      const parts = action.targetId.split(":");
                      const productId = parseInt(parts[0]);
                      const quantity =
                        parts.length > 1 ? parseInt(parts[1]) : 1;
                      productService
                        .getProductById(productId)
                        .then((product) => {
                          if (product) addToCart(product, quantity);
                        });
                    } catch (err) {
                      console.log("Error processing ADD_TO_CART action:", err);
                    }
                  }
                }
              }
            }
          }, 50);
        },
        (error) => {
          setIsLoading(false);
          if (streamTimer.current) {
            clearInterval(streamTimer.current);
            streamTimer.current = null;
          }
          if (checkDoneTimer.current) {
            clearInterval(checkDoneTimer.current);
            checkDoneTimer.current = null;
          }
          console.error("Failed to send assistant message stream:", error);
          setMessages((current) =>
            current.map((m) =>
              m.id === botMessageId && m.text === ""
                ? {
                    ...m,
                    text: "Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau.",
                    isStreaming: false,
                  }
                : { ...m, isStreaming: false },
            ),
          );
        },
      );
    });
  };

  const renderMessageItem = React.useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isBuyer = item.from === "buyer";
      return (
        <>
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
                          prod.thumbnail || "https://via.placeholder.com/100",
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
              {isBuyer ? (
                <Text style={[styles.messageText, styles.buyerText]}>
                  {item.text}
                </Text>
              ) : item.text ? (
                item.isStreaming ? (
                  <Text style={[styles.messageText, styles.sellerText]}>
                    {item.text}
                  </Text>
                ) : (
                  <Markdown style={markdownStyles}>{item.text}</Markdown>
                )
              ) : (
                <Text
                  style={[
                    styles.messageText,
                    styles.sellerText,
                    { fontStyle: "italic", color: "#888" },
                  ]}
                >
                  Đang xử lý...
                </Text>
              )}
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
        </>
      );
    },
    [],
  );

  const scrollToLatestMessage = React.useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    const handleKeyboardShow = (event: KeyboardEvent) => {
      setKeyboardVisible(true);
      scrollToLatestMessage();
    };

    const handleKeyboardHide = () => {
      setKeyboardVisible(false);
      scrollToLatestMessage(false);
    };

    const showSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      handleKeyboardShow,
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      handleKeyboardHide,
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [scrollToLatestMessage]);

  const handleBack = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={handleBack}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
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
        ref={listRef}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        onContentSizeChange={() => scrollToLatestMessage()}
        onLayout={() => scrollToLatestMessage(false)}
        renderItem={renderMessageItem}
      />

      {!isGenerating && !keyboardVisible && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Gợi ý nhanh:</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[
              { id: "1", text: "Gợi ý sản phẩm nổi bật", icon: "✨" },
              { id: "2", text: "Tìm điện thoại giá tốt", icon: "📱" },
              { id: "3", text: "Kiểm tra đơn hàng của tôi", icon: "📦" },
              { id: "4", text: "Giày chạy bộ nam", icon: "👟" },
            ]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.suggestionsContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionChip}
                onPress={() => handleSend(item.text)}
              >
                <Text style={styles.suggestionIcon}>{item.icon}</Text>
                <Text style={styles.suggestionText}>{item.text}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View style={[styles.composer, { paddingBottom: bottomInset }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Hỏi AI trợ lý..."
          placeholderTextColor="#999"
          selectionColor={Colors.light.tint}
          textAlignVertical="top"
          multiline
          editable={!isGenerating}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!draft.trim() || isGenerating) && styles.sendMuted,
          ]}
          onPress={() => handleSend()}
          disabled={!draft.trim() || isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: 16,
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
  suggestionsContainer: {
    paddingVertical: 10,
    backgroundColor: "#f5f5f5",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  suggestionsTitle: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  suggestionsContent: {
    paddingHorizontal: 12,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  suggestionIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  suggestionText: {
    fontSize: 13,
    color: "#333",
    fontWeight: "500",
  },
});
