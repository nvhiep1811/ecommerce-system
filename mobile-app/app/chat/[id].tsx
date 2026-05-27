import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { chatService } from "@/services/chatService";
import { productService } from "@/services/productService";
import { ChatConversation, ChatMessage } from "@/types/chat";
import { Product } from "@/types/product";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
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

const QUICK_REPLIES = [
  "Xin chào",
  "Sản phẩm còn hàng không?",
  "Cho mình xin thêm ảnh thật",
  "Shop tư vấn size giúp mình",
  "Có mã giảm giá không?",
  "Bao lâu giao hàng?",
  "Mình muốn mua ngay",
  "Cảm ơn shop",
];

const STICKERS = [
  { icon: "happy-outline" as const, label: "Hi" },
  { icon: "thumbs-up-outline" as const, label: "OK" },
  { icon: "heart-outline" as const, label: "Cảm ơn" },
  { icon: "sparkles-outline" as const, label: "Tuyệt" },
  { icon: "help-circle-outline" as const, label: "Hỏi thêm" },
  { icon: "chatbubble-ellipses-outline" as const, label: "Tư vấn" },
  { icon: "flash-outline" as const, label: "Nhanh" },
  { icon: "gift-outline" as const, label: "Voucher" },
];

const getParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const formatTime = (value: string | null) => {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const productFromConversation = (
  conversation: ChatConversation | null,
): Product | null => {
  if (!conversation?.product_id) {
    return null;
  }

  return {
    id: conversation.product_id,
    sub_category_id: 0,
    name: conversation.product_name ?? "Sản phẩm đang hỏi",
    description: null,
    thumbnail: conversation.product_thumbnail,
    price: conversation.product_price ?? 0,
    stock: 1,
    unit: null,
    rating: 0,
    review_count: 0,
    brand: null,
    seller_id: conversation.seller_id,
    seller_name: conversation.seller_name,
  };
};

const isVideoMessage = (message: ChatMessage) =>
  message.message_type === "FILE" &&
  Boolean(message.file_url?.match(/\.(mp4|mov|webm)(\?|$)/i));

const getMessagePreview = (message: ChatMessage | null) => {
  if (!message) return "";
  if (message.content?.trim()) return message.content.trim();
  if (message.message_type === "IMAGE") return "Ảnh";
  if (isVideoMessage(message)) return "Video";
  return message.file_name || "Tệp đính kèm";
};

export default function SellerChatScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const conversationId = Number(getParam(id));
  const socketRef = useRef<WebSocket | null>(null);
  const [conversation, setConversation] = useState<ChatConversation | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [productPickerVisible, setProductPickerVisible] = useState(false);
  const [quickCheckoutVisible, setQuickCheckoutVisible] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [askedProducts, setAskedProducts] = useState<Product[]>([]);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [quickQuantity, setQuickQuantity] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
    null,
  );
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  useEffect(() => {
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      setError("Cuộc trò chuyện không hợp lệ");
      setLoading(false);
      return;
    }

    let active = true;
    const loadChat = async () => {
      try {
        setLoading(true);
        setError(null);
        const [conversationData, messageData] = await Promise.all([
          chatService.getConversation(conversationId),
          chatService.listMessages(conversationId),
        ]);

        if (!active) {
          return;
        }

        setConversation(conversationData);
        setMessages(messageData);
        void chatService.markRead(conversationId);

        const fallbackProduct = productFromConversation(conversationData);
        if (fallbackProduct) {
          setActiveProduct(fallbackProduct);
          setAskedProducts([fallbackProduct]);
          productService
            .getProductById(fallbackProduct.id)
            .then((freshProduct) => {
              if (active) {
                setActiveProduct(freshProduct);
                setAskedProducts([freshProduct]);
              }
            })
            .catch(() => undefined);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Không thể tải tin nhắn",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadChat();
    return () => {
      active = false;
    };
  }, [conversationId, user?.id]);

  useEffect(() => {
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      return;
    }

    let closedByScreen = false;
    const connect = async () => {
      const url = await chatService.getWebSocketUrl();
      if (closedByScreen) {
        return;
      }

      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: "subscribe",
            conversationId,
          }),
        );
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "presence" && payload.userId) {
            setConversation((current) => {
              if (!current) {
                return current;
              }
              const peerId =
                current.customer_id === user?.id
                  ? current.seller_id
                  : current.customer_id;
              return peerId === payload.userId
                ? { ...current, peer_online: Boolean(payload.online) }
                : current;
            });
            return;
          }

          if (payload.type !== "message" || !payload.message) {
            return;
          }
          const message = chatService.mapMessage(payload.message);
          setMessages((current) => {
            if (current.some((item) => item.id === message.id)) {
              return current;
            }
            return [...current, message];
          });
          if (message.sender_id !== user?.id) {
            void chatService.markRead(conversationId);
          }
        } catch {}
      };
    };

    void connect();
    return () => {
      closedByScreen = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [conversationId, user?.id]);

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const normalizedProductQuery = productQuery.trim().toLowerCase();
  const filteredProducts = products.filter((item) => {
    if (!normalizedProductQuery) {
      return true;
    }

    return item.name.toLowerCase().includes(normalizedProductQuery);
  });
  const checkoutProduct = activeProduct ?? askedProducts[0] ?? null;
  const checkoutTotal = checkoutProduct ? checkoutProduct.price * quickQuantity : 0;

  const title =
    conversation?.peer_name ||
    conversation?.seller_name ||
    conversation?.customer_name ||
    "Người dùng";

  const loadSellerProducts = async () => {
    if (productsLoading || products.length > 0) {
      return;
    }

    try {
      setProductsLoading(true);
      const nextProducts = conversation?.seller_id
        ? await productService.getSellerProducts(conversation.seller_id)
        : await productService.getFeaturedProducts(20);
      setProducts(nextProducts);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách sản phẩm",
      );
    } finally {
      setProductsLoading(false);
    }
  };

  const addAskedProduct = (product: Product) => {
    setActiveProduct(product);
    setAskedProducts((current) => {
      if (current.some((item) => item.id === product.id)) {
        return current;
      }

      return [product, ...current].slice(0, 12);
    });
  };

  const handleSend = async (contentOverride?: string) => {
    const content = (contentOverride ?? draft).trim();
    if (!content || sending) {
      return;
    }
    const messageContent = replyingTo
      ? `Trả lời "${getMessagePreview(replyingTo)}": ${content}`
      : content;

    try {
      setSending(true);
      setDraft("");
      setReplyingTo(null);
      setShowActions(false);
      const saved = await chatService.sendMessage(conversationId, messageContent);
      setMessages((current) =>
        current.some((item) => item.id === saved.id)
          ? current
          : [...current, saved],
      );
    } catch (sendError) {
      if (!contentOverride) {
        setDraft(content);
      }
      if (replyingTo) {
        setReplyingTo(replyingTo);
      }
      setError(
        sendError instanceof Error ? sendError.message : "Không thể gửi tin nhắn",
      );
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async (source: "library" | "camera") => {
    if (sending) {
      return;
    }

    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Cần quyền truy cập", "Vui lòng cấp quyền để chọn ảnh hoặc video.");
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images", "videos"],
              quality: 0.85,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images", "videos"],
              quality: 0.85,
            });

      setShowActions(false);
      const asset = result.assets?.[0];
      if (!result.canceled && asset) {
        setSending(true);
        const saved = await chatService.sendMediaMessage(conversationId, {
          uri: asset.uri,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
        });
        setMessages((current) =>
          current.some((item) => item.id === saved.id)
            ? current
            : [...current, saved],
        );
      }
    } catch (mediaError) {
      Alert.alert(
        "Không thể gửi tệp",
        mediaError instanceof Error ? mediaError.message : "Vui lòng thử lại sau.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleOpenProducts = () => {
    setProductPickerVisible(true);
    setShowActions(false);
    setShowEmoji(false);
    void loadSellerProducts();
  };

  const handleAskProduct = async (product: Product) => {
    addAskedProduct(product);
    setProductPickerVisible(false);
    await handleSend(`Mình muốn hỏi về sản phẩm: ${product.name}`);
  };

  const handleOpenCheckout = (product?: Product | null) => {
    const targetProduct = product ?? checkoutProduct;
    if (!targetProduct) {
      return;
    }

    setActiveProduct(targetProduct);
    setQuickQuantity(1);
    setQuickCheckoutVisible(true);
  };

  const handleContinueCheckout = () => {
    if (!checkoutProduct) {
      return;
    }

    setQuickCheckoutVisible(false);
    router.push({
      pathname: "/orders/invoice",
      params: {
        buyNowProductId: String(checkoutProduct.id),
        buyNowQuantity: String(quickQuantity),
      },
    });
  };

  const renderProductThumb = (product: Product, size = 54) =>
    product.thumbnail ? (
      <Image
        source={{ uri: product.thumbnail }}
        style={[styles.productThumb, { width: size, height: size }]}
      />
    ) : (
      <View style={[styles.productThumbFallback, { width: size, height: size }]}>
        <Ionicons name="cube-outline" size={size * 0.42} color={Colors.light.tint} />
      </View>
    );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace("/chat/index" as any);
          }}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={28} color={Colors.light.tint} />
        </TouchableOpacity>
        <View style={styles.storeAvatar}>
          {conversation?.product_thumbnail ? (
            <Image
              source={{ uri: conversation.product_thumbnail }}
              style={styles.storeAvatarImage}
            />
          ) : (
            <Ionicons name="storefront-outline" size={22} color="#fff" />
          )}
        </View>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.subtitle} numberOfLines={1}>
              {conversation?.peer_online
                ? "Trực tuyến | 22K+ người mua hàng"
                : "Đang ngoại tuyến | 22K+ người mua hàng"}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="storefront-outline" size={24} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="#555" />
        </TouchableOpacity>
      </View>

      {checkoutProduct ? (
        <View style={styles.productStrip}>
          {renderProductThumb(checkoutProduct, 58)}
          <TouchableOpacity
            style={styles.productStripInfo}
            onPress={() => router.push(`/detail/${checkoutProduct.id}`)}
          >
            <Text style={styles.productStripName} numberOfLines={1}>
              {checkoutProduct.name}
            </Text>
            <View style={styles.productBadgeRow}>
              <View style={styles.askedBadge}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={12}
                  color={Colors.light.tint}
                />
                <Text style={styles.askedBadgeText}>Da hoi</Text>
              </View>
            </View>
            <Text style={styles.productStripPrice}>
              {formatCurrencyVnd(checkoutProduct.price)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.buyNowInline}
            onPress={() => handleOpenCheckout(checkoutProduct)}
          >
            <Ionicons name="cart-outline" size={20} color="#fff" />
            <Text style={styles.buyNowInlineText}>Mua ngay</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.light.tint} />
        </View>
      ) : error && messages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
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
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={
              error ? <Text style={styles.inlineError}>{error}</Text> : null
            }
            renderItem={({ item }) => {
              const isMine = item.sender_id === user?.id;
              const isImage = item.message_type === "IMAGE" && item.file_url;
              const isVideo = isVideoMessage(item);
              return (
                <View
                  style={[
                    styles.messageRow,
                    isMine ? styles.messageRowMine : styles.messageRowOther,
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onLongPress={() => setSelectedMessage(item)}
                    style={[
                      styles.messageBubble,
                      isMine ? styles.mineBubble : styles.otherBubble,
                    ]}
                  >
                    {isImage ? (
                      <Image
                        source={{ uri: item.file_url! }}
                        style={styles.messageImage}
                        contentFit="cover"
                      />
                    ) : isVideo ? (
                      <TouchableOpacity
                        style={styles.mediaAttachment}
                        onPress={() => item.file_url && Linking.openURL(item.file_url)}
                      >
                        <View style={styles.mediaIcon}>
                          <Ionicons name="play" size={20} color="#fff" />
                        </View>
                        <View style={styles.mediaTextWrap}>
                          <Text
                            style={[
                              styles.mediaTitle,
                              isMine ? styles.mineText : styles.otherText,
                            ]}
                            numberOfLines={1}
                          >
                            {item.file_name || "Video"}
                          </Text>
                          <Text
                            style={[
                              styles.mediaSubtitle,
                              isMine ? styles.mineTime : styles.otherTime,
                            ]}
                          >
                            Nhấn để xem video
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : null}
                    {item.content && !isImage && !isVideo ? (
                      <Text
                        style={[
                          styles.messageText,
                          isMine ? styles.mineText : styles.otherText,
                        ]}
                      >
                        {item.content}
                      </Text>
                    ) : null}
                    <Text
                      style={[
                        styles.messageTime,
                        isMine ? styles.mineTime : styles.otherTime,
                      ]}
                    >
                      {formatTime(item.created_at)}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />

          <View style={styles.quickReplyWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickReplyContent}
            >
              {QUICK_REPLIES.map((reply) => (
                <TouchableOpacity
                  key={reply}
                  style={styles.quickReply}
                  onPress={() => handleSend(reply)}
                  disabled={sending}
                >
                  <Ionicons name="reorder-four-outline" size={15} color={Colors.light.tint} />
                  <Text style={styles.quickReplyText}>{reply}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {replyingTo ? (
            <View style={styles.replyPreview}>
              <View style={styles.replyBar} />
              <View style={styles.replyContent}>
                <Text style={styles.replyLabel}>Đang trả lời</Text>
                <Text style={styles.replyText} numberOfLines={1}>
                  {getMessagePreview(replyingTo)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Ionicons name="close" size={20} color="#777" />
              </TouchableOpacity>
            </View>
          ) : null}

          <View
            style={[
              styles.composer,
              { paddingBottom: 8 + Math.max(insets.bottom, 0) },
            ]}
          >
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setShowActions((current) => !current);
                setShowEmoji(false);
              }}
            >
              <Ionicons
                name={showActions ? "close-circle-outline" : "add-circle-outline"}
                size={34}
                color="#6f6f6f"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleOpenProducts}>
              <Ionicons name="bag-outline" size={32} color="#6f6f6f" />
              {askedProducts.length > 0 ? (
                <View style={styles.productCountBadge}>
                  <Text style={styles.productCountText}>
                    {askedProducts.length > 9 ? "9+" : askedProducts.length}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Gửi tin nhắn ..."
                placeholderTextColor="#bbb"
                multiline
              />
              <TouchableOpacity
                style={styles.emojiButton}
                onPress={() => {
                  setShowEmoji((current) => !current);
                  setShowActions(false);
                }}
              >
                <Ionicons
                  name={showEmoji ? "keypad-outline" : "happy-outline"}
                  size={30}
                  color="#6f6f6f"
                />
              </TouchableOpacity>
            </View>
            {draft.trim() ? (
              <TouchableOpacity
                style={styles.arrowSendButton}
                onPress={() => handleSend()}
                disabled={sending}
              >
                <Ionicons name="send" size={31} color={Colors.light.tint} />
              </TouchableOpacity>
            ) : null}
          </View>

          {showActions ? (
            <View style={styles.actionPanel}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handlePickImage("library")}
              >
                <View style={styles.actionIconBox}>
                  <Ionicons name="image-outline" size={34} color="#555" />
                </View>
                <Text style={styles.actionLabel}>Thư viện</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handlePickImage("camera")}
              >
                <View style={styles.actionIconBox}>
                  <Ionicons name="camera-outline" size={34} color="#555" />
                </View>
                <Text style={styles.actionLabel}>Máy ảnh</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {showEmoji ? (
            <View style={styles.emojiPanel}>
              {STICKERS.map((sticker) => (
                <TouchableOpacity
                  key={sticker.label}
                  style={styles.stickerItem}
                  onPress={() => handleSend(sticker.label)}
                  disabled={sending}
                >
                  <Ionicons name={sticker.icon} size={42} color={Colors.light.tint} />
                  <Text style={styles.stickerLabel}>{sticker.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      )}

      <Modal
        animationType="fade"
        transparent
        visible={Boolean(selectedMessage)}
        onRequestClose={() => setSelectedMessage(null)}
      >
        <TouchableOpacity
          style={styles.messageActionOverlay}
          activeOpacity={1}
          onPress={() => setSelectedMessage(null)}
        >
          <View style={styles.messageActionSheet}>
            <TouchableOpacity
              style={styles.messageActionItem}
              onPress={() => {
                setReplyingTo(selectedMessage);
                setSelectedMessage(null);
              }}
            >
              <Ionicons name="return-up-back-outline" size={22} color="#333" />
              <Text style={styles.messageActionText}>Trả lời</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.messageActionItem}
              onPress={() => {
                setDraft(getMessagePreview(selectedMessage));
                setSelectedMessage(null);
              }}
            >
              <Ionicons name="arrow-redo-outline" size={22} color="#333" />
              <Text style={styles.messageActionText}>Chuyển tiếp</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        animationType="slide"
        visible={productPickerVisible}
        onRequestClose={() => setProductPickerVisible(false)}
      >
        <SafeAreaView style={styles.productModal}>
          <View style={styles.productModalHeader}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setProductPickerVisible(false)}
            >
              <Ionicons name="arrow-back" size={28} color={Colors.light.tint} />
            </TouchableOpacity>
            <Text style={styles.productModalTitle}>Chon San Pham</Text>
            <TouchableOpacity
              style={styles.productDoneButton}
              onPress={() => setProductPickerVisible(false)}
            >
              <Text style={styles.productDoneText}>Chon</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productSearch}>
            <Ionicons name="search" size={25} color="#777" />
            <TextInput
              style={styles.productSearchInput}
              value={productQuery}
              onChangeText={setProductQuery}
              placeholder={`Tim ${conversation?.seller_name ?? "san pham"}`}
              placeholderTextColor="#aaa"
            />
          </View>

          {askedProducts.length > 0 ? (
            <View style={styles.pendingSection}>
              <Text style={styles.pendingTitle}>Da gui hoac dang cho hoi</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {askedProducts.map((product) => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.pendingProduct}
                    onPress={() => {
                      setActiveProduct(product);
                      setProductPickerVisible(false);
                    }}
                  >
                    {renderProductThumb(product, 44)}
                    <Text style={styles.pendingProductName} numberOfLines={1}>
                      {product.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {productsLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={Colors.light.tint} />
            </View>
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.productListContent}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyText}>Chua co san pham phu hop</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.productChoice}>
                  {renderProductThumb(item, 74)}
                  <View style={styles.productChoiceInfo}>
                    <Text style={styles.productChoiceName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <View style={styles.variantPill}>
                      <Text style={styles.variantPillText}>Chon bien the</Text>
                      <Ionicons name="chevron-down" size={16} color="#888" />
                    </View>
                    <Text style={styles.productChoicePrice}>
                      {formatCurrencyVnd(item.price)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.askProductButton}
                    onPress={() => handleAskProduct(item)}
                    disabled={sending}
                  >
                    <Text style={styles.askProductText}>Gui</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={quickCheckoutVisible}
        onRequestClose={() => setQuickCheckoutVisible(false)}
      >
        <View style={styles.checkoutOverlay}>
          <TouchableOpacity
            style={styles.checkoutScrim}
            activeOpacity={1}
            onPress={() => setQuickCheckoutVisible(false)}
          />
          <View
            style={[
              styles.checkoutSheet,
              { paddingBottom: 18 + Math.max(insets.bottom, 0) },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Thanh toan nhanh</Text>
              <TouchableOpacity onPress={() => setQuickCheckoutVisible(false)}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>
            {checkoutProduct ? (
              <>
                <View style={styles.checkoutProductRow}>
                  {renderProductThumb(checkoutProduct, 72)}
                  <View style={styles.checkoutProductInfo}>
                    <Text style={styles.checkoutProductName} numberOfLines={2}>
                      {checkoutProduct.name}
                    </Text>
                    <Text style={styles.checkoutPrice}>
                      {formatCurrencyVnd(checkoutProduct.price)}
                    </Text>
                  </View>
                </View>
                <View style={styles.quantityRow}>
                  <Text style={styles.quantityLabel}>So luong</Text>
                  <View style={styles.quantityStepper}>
                    <TouchableOpacity
                      style={[
                        styles.quantityButton,
                        quickQuantity <= 1 && styles.quantityButtonDisabled,
                      ]}
                      onPress={() =>
                        setQuickQuantity((current) => Math.max(1, current - 1))
                      }
                      disabled={quickQuantity <= 1}
                    >
                      <Ionicons
                        name="remove"
                        size={18}
                        color={quickQuantity <= 1 ? "#aaa" : "#333"}
                      />
                    </TouchableOpacity>
                    <Text style={styles.quantityValue}>{quickQuantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() =>
                        setQuickQuantity((current) => Math.min(99, current + 1))
                      }
                    >
                      <Ionicons name="add" size={18} color="#333" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tam tinh</Text>
                  <Text style={styles.totalValue}>
                    {formatCurrencyVnd(checkoutTotal)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.checkoutButton}
                  onPress={handleContinueCheckout}
                >
                  <Text style={styles.checkoutButtonText}>Mua ngay</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f3f3",
  },
  header: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ececec",
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  storeAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
    marginRight: 10,
  },
  storeAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#f2f2f2",
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
  },
  onlineRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
    backgroundColor: "#16a34a",
  },
  subtitle: {
    flex: 1,
    fontSize: 13,
    color: "#777",
  },
  productStrip: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e8e8e8",
  },
  productThumb: {
    borderRadius: 7,
    backgroundColor: "#f2f2f2",
  },
  productThumbFallback: {
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff4f1",
  },
  productStripInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  productStripName: {
    fontSize: 17,
    color: "#222",
    marginBottom: 4,
  },
  productBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  askedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 4,
    borderColor: Colors.light.tint,
  },
  askedBadgeText: {
    fontSize: 12,
    color: Colors.light.tint,
  },
  productStripPrice: {
    fontSize: 18,
    color: Colors.light.tint,
    fontWeight: "700",
  },
  buyNowInline: {
    height: 44,
    minWidth: 116,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: "#ff3f29",
  },
  buyNowInlineText: {
    color: "#fff",
    fontSize: 16,
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
  messageRowMine: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "82%",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  mineBubble: {
    backgroundColor: Colors.light.tint,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ececec",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  mediaAttachment: {
    minWidth: 220,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mediaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
  },
  mediaTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  mediaTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  mediaSubtitle: {
    marginTop: 3,
    fontSize: 12,
  },
  mineText: {
    color: "#fff",
  },
  otherText: {
    color: "#202020",
  },
  messageTime: {
    marginTop: 4,
    fontSize: 11,
    alignSelf: "flex-end",
  },
  mineTime: {
    color: "rgba(255,255,255,0.82)",
  },
  otherTime: {
    color: "#999",
  },
  quickReplyWrap: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f1f1f1",
  },
  quickReplyContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  quickReply: {
    minHeight: 40,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ececec",
  },
  quickReplyText: {
    fontSize: 14,
    color: Colors.light.tint,
  },
  replyPreview: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f1f1f1",
  },
  replyBar: {
    width: 3,
    height: 34,
    borderRadius: 2,
    backgroundColor: Colors.light.tint,
  },
  replyContent: {
    flex: 1,
    minWidth: 0,
  },
  replyLabel: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: "700",
  },
  replyText: {
    marginTop: 3,
    fontSize: 13,
    color: "#555",
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingTop: 10,
    backgroundColor: "#fff",
  },
  iconButton: {
    width: 38,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  productCountBadge: {
    position: "absolute",
    top: 3,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
  },
  productCountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  inputWrap: {
    flex: 1,
    minHeight: 46,
    maxHeight: 112,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#e4e4e4",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 108,
    paddingVertical: 9,
    fontSize: 17,
    color: "#222",
  },
  emojiButton: {
    width: 46,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowSendButton: {
    width: 36,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPanel: {
    minHeight: 188,
    flexDirection: "row",
    gap: 30,
    paddingHorizontal: 46,
    paddingTop: 28,
    backgroundColor: "#fff",
  },
  actionItem: {
    width: 96,
    alignItems: "center",
  },
  actionIconBox: {
    width: 74,
    height: 74,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ededed",
    backgroundColor: "#fff",
  },
  actionLabel: {
    marginTop: 10,
    fontSize: 15,
    color: "#666",
  },
  emojiPanel: {
    minHeight: 260,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    backgroundColor: "#fff",
  },
  stickerItem: {
    width: "25%",
    minHeight: 92,
    alignItems: "center",
    justifyContent: "center",
  },
  stickerLabel: {
    marginTop: 7,
    fontSize: 13,
    color: "#666",
  },
  messageActionOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  messageActionSheet: {
    margin: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  messageActionItem: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  messageActionText: {
    fontSize: 16,
    color: "#222",
    fontWeight: "600",
  },
  productModal: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  productModalHeader: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
  },
  productModalTitle: {
    flex: 1,
    fontSize: 24,
    color: "#222",
    fontWeight: "500",
  },
  productDoneButton: {
    paddingHorizontal: 12,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  productDoneText: {
    color: Colors.light.tint,
    fontSize: 17,
    fontWeight: "600",
  },
  productSearch: {
    minHeight: 54,
    margin: 14,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: "#ededed",
  },
  productSearchInput: {
    flex: 1,
    fontSize: 18,
    color: "#222",
  },
  pendingSection: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  pendingTitle: {
    marginBottom: 8,
    color: "#777",
    fontSize: 13,
    fontWeight: "600",
  },
  pendingProduct: {
    width: 154,
    marginRight: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    backgroundColor: "#fff",
  },
  pendingProductName: {
    flex: 1,
    color: "#333",
    fontSize: 12,
  },
  productListContent: {
    paddingHorizontal: 10,
    paddingBottom: 20,
    gap: 10,
  },
  productChoice: {
    minHeight: 112,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
  },
  productChoiceInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  productChoiceName: {
    fontSize: 18,
    lineHeight: 23,
    color: "#202020",
  },
  variantPill: {
    alignSelf: "flex-start",
    marginTop: 7,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ddd",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#fafafa",
  },
  variantPillText: {
    color: "#666",
    fontSize: 14,
  },
  productChoicePrice: {
    marginTop: 8,
    color: Colors.light.tint,
    fontSize: 18,
    fontWeight: "700",
  },
  askProductButton: {
    width: 76,
    height: 44,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  askProductText: {
    color: Colors.light.tint,
    fontSize: 18,
    fontWeight: "600",
  },
  checkoutOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  checkoutScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  checkoutSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: "#fff",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
    backgroundColor: "#ddd",
  },
  sheetHeader: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#222",
  },
  checkoutProductRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  checkoutProductInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  checkoutProductName: {
    fontSize: 16,
    lineHeight: 21,
    color: "#222",
  },
  checkoutPrice: {
    marginTop: 8,
    color: Colors.light.tint,
    fontSize: 18,
    fontWeight: "800",
  },
  quantityRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  quantityLabel: {
    color: "#333",
    fontSize: 16,
  },
  quantityStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 6,
  },
  quantityButton: {
    width: 38,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonDisabled: {
    opacity: 0.45,
  },
  quantityValue: {
    minWidth: 38,
    textAlign: "center",
    color: "#222",
    fontWeight: "700",
  },
  totalRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: {
    color: "#666",
    fontSize: 15,
  },
  totalValue: {
    color: Colors.light.tint,
    fontSize: 20,
    fontWeight: "800",
  },
  checkoutButton: {
    height: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff3f29",
  },
  checkoutButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 17,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    color: "#777",
    fontSize: 14,
  },
  errorText: {
    color: Colors.light.tint,
    textAlign: "center",
  },
  inlineError: {
    alignSelf: "center",
    marginBottom: 8,
    fontSize: 12,
    color: Colors.light.tint,
  },
});
