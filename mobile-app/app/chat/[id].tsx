import { Colors } from "@/constants/theme";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type ChatMessage = {
  id: string;
  text: string;
  from: "buyer" | "seller";
  time: string;
};

const getNowLabel = () =>
  new Date().toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

const getParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default function SellerChatScreen() {
  const insets = useSafeAreaInsets();
  const { sellerName, productName, productPrice, productImage } =
    useLocalSearchParams<{
    id?: string;
    sellerName?: string;
    productName?: string;
    productPrice?: string;
    productImage?: string;
  }>();
  const resolvedSellerName = getParam(sellerName) || "MegaMall Seller";
  const resolvedProductName = getParam(productName);
  const resolvedProductPrice = Number(getParam(productPrice) ?? 0);
  const resolvedProductImage = getParam(productImage);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      from: "seller",
      text: `Xin chào, ${resolvedSellerName} có thể hỗ trợ gì cho bạn?`,
      time: getNowLabel(),
    },
  ]);

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}`,
        from: "buyer",
        text,
        time: getNowLabel(),
      },
    ]);
    setDraft("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }

              router.replace("/chat/index" as any);
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {resolvedSellerName}
          </Text>
          <Text style={styles.subtitle}>Đang hoạt động</Text>
        </View>
        <View style={styles.headerSide}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color="#fff" />
        </View>
      </View>

      {resolvedProductName ? (
        <View style={styles.productCard}>
          {resolvedProductImage ? (
            <Image
              source={{ uri: resolvedProductImage }}
              style={styles.productImage}
            />
          ) : (
            <View style={styles.productIcon}>
              <Ionicons
                name="cube-outline"
                size={20}
                color={Colors.light.tint}
              />
            </View>
          )}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={1}>
              {resolvedProductName}
            </Text>
            <Text style={styles.productPrice}>
              {formatCurrencyVnd(resolvedProductPrice)}
            </Text>
          </View>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <FlatList
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          data={reversedMessages}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isBuyer = item.from === "buyer";
            return (
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
            );
          }}
        />

        <View
          style={[
            styles.composer,
            { paddingBottom: 10 + Math.max(insets.bottom, 0) },
          ]}
        >
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#999"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !draft.trim() && styles.sendMuted]}
            onPress={handleSend}
            disabled={!draft.trim()}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingVertical: 10,
    minHeight: 56,
    backgroundColor: Colors.light.tint,
  },
  headerSide: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backButton: {
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
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  productIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff5f5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: "#f2f2f2",
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 14,
    color: "#333",
    fontWeight: "700",
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 13,
    color: Colors.light.tint,
    fontWeight: "700",
  },
  keyboardArea: {
    flex: 1,
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
    paddingTop: 10,
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
});
