import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { chatService } from "@/services/chatService";
import { productService } from "@/services/productService";
import { ChatConversation, ChatMessage } from "@/types/chat";
import { Product } from "@/types/product";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { router, useLocalSearchParams } from "expo-router";
import { useChatWebSocket } from "@/hooks/use-chat-websocket";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
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

const SWIPE_REPLY_THRESHOLD = 56;
const SWIPE_REPLY_MAX_DISTANCE = 82;
const CHAT_BLUE = "#00a8b5";
const CHAT_MINE_BUBBLE = "#d7f7f5";
const CHAT_HIGHLIGHT = "#b8eeec";
const QUOTE_ACCENT = "#008f9b";
const QUOTE_LABEL = "#202020";
const VIDEO_EXTENSION_PATTERN = /\.(mp4|mov|webm|m4v)(\?|$)/i;

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
  Boolean(
    message.file_url?.match(VIDEO_EXTENSION_PATTERN) ||
    message.file_name?.match(VIDEO_EXTENSION_PATTERN),
  );

const isVideoPickerAsset = (asset: ImagePicker.ImagePickerAsset) =>
  Boolean(
    asset.mimeType?.startsWith("video/") ||
    asset.fileName?.match(VIDEO_EXTENSION_PATTERN) ||
    asset.uri.match(VIDEO_EXTENSION_PATTERN),
  );

const parseReplyContent = (content: string | null) => {
  if (!content) {
    return { quote: null, body: null };
  }

  if (!content.trimStart().startsWith("Tr")) {
    return { quote: null, body: content };
  }

  const firstQuoteIndex = content.indexOf('"');
  const separatorIndex = content.lastIndexOf('":');
  if (firstQuoteIndex < 0 || separatorIndex <= firstQuoteIndex) {
    return { quote: null, body: content };
  }

  return {
    quote: content.slice(firstQuoteIndex + 1, separatorIndex).trim() || null,
    body: content.slice(separatorIndex + 2).trim() || null,
  };
};

const getContentPreview = (content: string | null): string | null => {
  const parsed = parseReplyContent(content);
  if (parsed.body?.trim()) {
    return parsed.body.trim();
  }
  if (parsed.quote && parsed.quote !== content) {
    return getContentPreview(parsed.quote);
  }
  return content?.trim() || null;
};

const getReplyPreview = (message: ChatMessage | null) => {
  if (!message) return "";
  const contentPreview = getContentPreview(message.content);
  if (
    contentPreview &&
    !(
      (message.message_type === "IMAGE" || isVideoMessage(message)) &&
      isGeneratedMediaCaption(contentPreview)
    )
  ) {
    return contentPreview;
  }
  if (message.message_type === "IMAGE") return "Ảnh";
  if (isVideoMessage(message)) return "Video";
  return message.file_name || "Tệp đính kèm";
};

const normalizeLookupText = (value: string | null | undefined) =>
  value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";

const getInitials = (value: string | null | undefined) => {
  const words = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) {
    return "?";
  }

  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
};

const isGeneratedMediaCaption = (value: string | null | undefined) => {
  const normalized = normalizeLookupText(value);
  return [
    "đã gửi một ảnh",
    "đã gửi 1 ảnh",
    "đã gửi ảnh",
    "đã gửi một video",
    "đã gửi 1 video",
    "đã gửi video",
    "sent an image",
    "sent a photo",
    "sent a video",
  ].includes(normalized);
};

const getMediaFileName = (message: ChatMessage) => {
  if (message.file_name?.trim()) {
    return message.file_name.trim();
  }

  const extension = isVideoMessage(message) ? "mp4" : "jpg";
  return `chat-media-${message.id}.${extension}`;
};

const getMessageSearchText = (message: ChatMessage) =>
  [
    getReplyPreview(message),
    parseReplyContent(message.content).quote,
    message.file_name,
    formatTime(message.created_at),
  ]
    .filter(Boolean)
    .join(" ");

type WebVideoProps = {
  uri: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  style?: any;
};

function WebVideo({
  uri,
  controls = false,
  autoPlay = false,
  muted = false,
  style,
}: WebVideoProps) {
  if (Platform.OS !== "web") {
    return null;
  }

  return React.createElement("video" as any, {
    src: uri,
    controls,
    autoPlay,
    muted,
    playsInline: true,
    preload: "metadata",
    style: StyleSheet.flatten(style),
  });
}

type SwipeReplyRowProps = {
  children: React.ReactNode;
  isMine: boolean;
  message: ChatMessage;
  onReply: (message: ChatMessage) => void;
};

function SwipeReplyRow({
  children,
  isMine,
  message,
  onReply,
}: SwipeReplyRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const didReply = useRef(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 10 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.35,
        onPanResponderGrant: () => {
          didReply.current = false;
        },
        onPanResponderMove: (_, gesture) => {
          const rawDistance = isMine
            ? Math.min(0, gesture.dx)
            : Math.max(0, gesture.dx);
          const distance = Math.max(
            -SWIPE_REPLY_MAX_DISTANCE,
            Math.min(SWIPE_REPLY_MAX_DISTANCE, rawDistance),
          );

          translateX.setValue(distance);
          if (
            Math.abs(distance) >= SWIPE_REPLY_THRESHOLD &&
            !didReply.current
          ) {
            didReply.current = true;
            onReply(message);
          }
        },
        onPanResponderRelease: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [isMine, message, onReply, translateX],
  );
  const hintOpacity = translateX.interpolate({
    inputRange: isMine
      ? [-SWIPE_REPLY_THRESHOLD, -16, 0]
      : [0, 16, SWIPE_REPLY_THRESHOLD],
    outputRange: isMine ? [1, 0, 0] : [0, 0, 1],
    extrapolate: "clamp",
  });

  return (
    <View
      style={[
        styles.messageRow,
        isMine ? styles.messageRowMine : styles.messageRowOther,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swipeReplyHint,
          isMine ? styles.swipeReplyHintMine : styles.swipeReplyHintOther,
          { opacity: hintOpacity },
        ]}
      >
        <Ionicons name="return-up-back-outline" size={18} color="#fff" />
      </Animated.View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.swipeMessageWrap,
          isMine ? styles.swipeMessageWrapMine : styles.swipeMessageWrapOther,
          { transform: [{ translateX }] },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

export default function SellerChatScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const conversationId = Number(getParam(id));

  const messagesListRef = useRef<FlatList<ChatMessage> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    number | null
  >(null);
  const [selectedMedia, setSelectedMedia] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [viewerMessage, setViewerMessage] = useState<ChatMessage | null>(null);
  const [savingMedia, setSavingMedia] = useState(false);
  const [chatInfoVisible, setChatInfoVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaLibraryVisible, setMediaLibraryVisible] = useState(false);
  const [mediaVisibleCount, setMediaVisibleCount] = useState(10);

  useEffect(
    () => () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    },
    [],
  );

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

  useChatWebSocket(
    (frame) => {
      try {
        const payload: any = frame;

        if (payload.type === "presence" && payload.userId) {
          setConversation((current) => {
            if (!current) return current;
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

        if (
          ["read", "message_read", "messages_read", "read_receipt"].includes(
            payload.type,
          )
        ) {
          const payloadConversationId = Number(
            payload.conversationId ?? payload.conversation_id,
          );
          const readerId =
            payload.userId ??
            payload.user_id ??
            payload.readerId ??
            payload.reader_id;

          if (
            (!Number.isFinite(payloadConversationId) ||
              payloadConversationId === conversationId) &&
            readerId !== user?.id
          ) {
            setMessages((current) =>
              current.map((message) =>
                message.sender_id === user?.id
                  ? { ...message, read: true }
                  : message,
              ),
            );
          }
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
    },
    (send) => {
      if (!Number.isFinite(conversationId) || conversationId <= 0) return;
      send({ type: "subscribe", conversationId });
    },
  );

  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const latestOwnReadMessageId = useMemo(() => {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.sender_id !== user?.id || !latestMessage.read) {
      return null;
    }

    return latestMessage.id;
  }, [messages, user?.id]);
  const mediaMessages = useMemo(
    () =>
      [...messages]
        .filter(
          (message) =>
            Boolean(message.file_url) &&
            (message.message_type === "IMAGE" || isVideoMessage(message)),
        )
        .reverse(),
    [messages],
  );
  const visibleMediaMessages = useMemo(
    () => mediaMessages.slice(0, mediaVisibleCount),
    [mediaMessages, mediaVisibleCount],
  );
  const latestMediaPreview = useMemo(
    () => mediaMessages.slice(0, 4),
    [mediaMessages],
  );
  const searchResults = useMemo(() => {
    const normalizedQuery = normalizeLookupText(searchQuery);
    if (!normalizedQuery) {
      return [];
    }

    const queryParts = normalizedQuery.split(" ").filter(Boolean);
    return [...messages]
      .reverse()
      .filter((message) => {
        const haystack = normalizeLookupText(getMessageSearchText(message));
        return (
          haystack.includes(normalizedQuery) ||
          queryParts.every((part) => haystack.includes(part))
        );
      })
      .slice(0, 50);
  }, [messages, searchQuery]);

  const flashMessage = (messageId: number) => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setHighlightedMessageId(messageId);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId((current) =>
        current === messageId ? null : current,
      );
    }, 1100);
  };

  const scrollToMessage = (targetMessage: ChatMessage) => {
    const targetIndex = reversedMessages.findIndex(
      (message) => message.id === targetMessage.id,
    );
    if (targetIndex < 0) {
      return;
    }

    flashMessage(targetMessage.id);
    messagesListRef.current?.scrollToIndex({
      index: targetIndex,
      animated: true,
      viewPosition: 0.5,
    });
  };

  const findQuotedMessage = (
    quote: string | null,
    sourceMessage: ChatMessage,
  ) => {
    const quoteRaw = normalizeLookupText(quote);
    const quotePreview = normalizeLookupText(getContentPreview(quote) ?? quote);
    if (!quoteRaw && !quotePreview) {
      return null;
    }

    const sourceIndex = messages.findIndex(
      (message) => message.id === sourceMessage.id,
    );
    const candidates =
      sourceIndex > -1 ? messages.slice(0, sourceIndex) : messages;

    return [...candidates].reverse().find((message) => {
      if (message.id === sourceMessage.id) {
        return false;
      }

      const messageRaw = normalizeLookupText(message.content);
      const messagePreview = normalizeLookupText(getReplyPreview(message));

      return (
        (quoteRaw && messageRaw === quoteRaw) ||
        (quotePreview && messagePreview === quotePreview) ||
        (quotePreview && messageRaw === quotePreview)
      );
    });
  };

  const handlePressQuote = (
    quote: string | null,
    sourceMessage: ChatMessage,
  ) => {
    const targetMessage = findQuotedMessage(quote, sourceMessage);
    if (!targetMessage) {
      return;
    }

    scrollToMessage(targetMessage);
  };

  const getMessageSenderName = (message: ChatMessage | null) => {
    if (!message) {
      return "Tin nhắn";
    }

    if (message.sender_id === user?.id) {
      return user.full_name || "Bạn";
    }

    if (message.sender_id === conversation?.seller_id) {
      return conversation.seller_name || "Shop";
    }

    if (message.sender_id === conversation?.customer_id) {
      return conversation.customer_name || "Khách hàng";
    }

    return message.sender_role === "SELLER" ? "Shop" : "Khách hàng";
  };

  const openMediaLibrary = () => {
    setMediaVisibleCount(10);
    setMediaLibraryVisible(true);
  };

  const handleSelectSearchResult = (message: ChatMessage) => {
    setSearchVisible(false);
    setChatInfoVisible(false);
    setMediaLibraryVisible(false);
    setTimeout(() => scrollToMessage(message), 180);
  };

  const handleSaveViewerMedia = async () => {
    if (!viewerMessage?.file_url || savingMedia) {
      return;
    }

    try {
      setSavingMedia(true);
      const fileName = getMediaFileName(viewerMessage).replace(
        /[\\/:*?"<>|]/g,
        "-",
      );

      if (Platform.OS === "web") {
        const documentRef = (globalThis as any).document;
        const anchor = documentRef?.createElement("a");
        if (!anchor) {
          await Linking.openURL(viewerMessage.file_url);
          return;
        }
        anchor.href = viewerMessage.file_url;
        anchor.download = fileName;
        anchor.rel = "noopener";
        documentRef.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        return;
      }

      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Cần quyền lưu",
          "Vui lòng cấp quyền truy cập thư viện để lưu file.",
        );
        return;
      }

      const targetFile = new FileSystem.File(
        FileSystem.Paths.cache,
        `${Date.now()}-${fileName}`,
      );
      const downloaded = await FileSystem.File.downloadFileAsync(
        viewerMessage.file_url,
        targetFile,
      );
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);
      Alert.alert("Đã lưu", "File đã được lưu vào thư viện.");
    } catch (saveError) {
      Alert.alert(
        "Không thể lưu",
        saveError instanceof Error
          ? saveError.message
          : "Vui lòng thử lại sau.",
      );
    } finally {
      setSavingMedia(false);
    }
  };

  const normalizedProductQuery = productQuery.trim().toLowerCase();
  const filteredProducts = products.filter((item) => {
    if (!normalizedProductQuery) {
      return true;
    }

    return item.name.toLowerCase().includes(normalizedProductQuery);
  });
  const checkoutProduct = activeProduct ?? askedProducts[0] ?? null;
  const checkoutTotal = checkoutProduct
    ? checkoutProduct.price * quickQuantity
    : 0;

  const title =
    conversation?.peer_name ||
    conversation?.seller_name ||
    conversation?.customer_name ||
    "Người dùng";
  const peerAvatarUri =
    conversation?.peer_avatar_url ??
    (conversation?.customer_id === user?.id
      ? conversation?.seller_avatar_url
      : conversation?.customer_avatar_url) ??
    null;
  const renderCircleAvatar = (
    uri: string | null | undefined,
    label: string | null | undefined,
    size: number,
  ) =>
    uri ? (
      <Image
        source={{ uri }}
        style={[
          styles.circleAvatarImage,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      />
    ) : (
      <View
        style={[
          styles.circleAvatarFallback,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Text
          style={[
            styles.circleAvatarText,
            { fontSize: Math.max(11, size * 0.36) },
          ]}
        >
          {getInitials(label)}
        </Text>
      </View>
    );

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
    if ((!content && selectedMedia.length === 0) || sending) {
      return;
    }
    const messageContent = replyingTo
      ? `Trả lời "${getReplyPreview(replyingTo)}": ${content}`
      : content;
    const mediaToSend = selectedMedia;
    const replySnapshot = replyingTo;

    try {
      setSending(true);
      setDraft("");
      setSelectedMedia([]);
      setReplyingTo(null);
      setShowActions(false);
      if (mediaToSend.length > 0) {
        for (const [index, asset] of mediaToSend.entries()) {
          const saved = await chatService.sendMediaMessage(conversationId, {
            uri: asset.uri,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
            fileSize: asset.fileSize,
            content: index === 0 ? messageContent || undefined : undefined,
          });
          setMessages((current) =>
            current.some((item) => item.id === saved.id)
              ? current
              : [...current, saved],
          );
        }
        return;
      }
      const saved = await chatService.sendMessage(
        conversationId,
        messageContent,
      );
      setMessages((current) =>
        current.some((item) => item.id === saved.id)
          ? current
          : [...current, saved],
      );
    } catch (sendError) {
      if (!contentOverride) {
        setDraft(content);
      }
      if (mediaToSend.length > 0) {
        setSelectedMedia(mediaToSend);
      }
      if (replySnapshot) {
        setReplyingTo(replySnapshot);
      }
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Không thể gửi tin nhắn",
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
        Alert.alert(
          "Cần quyền truy cập",
          "Vui lòng cấp quyền để chọn ảnh hoặc video.",
        );
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
              allowsMultipleSelection: true,
              quality: 0.85,
            });

      setShowActions(false);
      const assets = result.assets ?? [];
      if (!result.canceled && assets.length > 0) {
        setSelectedMedia((current) => [...current, ...assets]);
        setShowEmoji(false);
      }
    } catch (mediaError) {
      Alert.alert(
        "Không thể gửi tệp",
        mediaError instanceof Error
          ? mediaError.message
          : "Vui lòng thử lại sau.",
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
      <View
        style={[styles.productThumbFallback, { width: size, height: size }]}
      >
        <Ionicons
          name="cube-outline"
          size={size * 0.42}
          color={Colors.light.tint}
        />
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
          {renderCircleAvatar(peerAvatarUri, title, 46)}
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
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            setShowActions(false);
            setShowEmoji(false);
            setChatInfoVisible(true);
          }}
        >
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
            ref={messagesListRef}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            data={reversedMessages}
            inverted
            keyExtractor={(item) => String(item.id)}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              messagesListRef.current?.scrollToOffset({
                offset: Math.max(0, index * averageItemLength),
                animated: true,
              });
              setTimeout(() => {
                messagesListRef.current?.scrollToIndex({
                  index,
                  animated: true,
                  viewPosition: 0.5,
                });
              }, 120);
            }}
            ListHeaderComponent={
              error ? <Text style={styles.inlineError}>{error}</Text> : null
            }
            renderItem={({ item }) => {
              const isMine = item.sender_id === user?.id;
              const isImage = item.message_type === "IMAGE" && item.file_url;
              const isVideo = isVideoMessage(item);
              const parsedContent = parseReplyContent(item.content);
              const isMedia = Boolean(isImage || isVideo);
              const bodyText =
                isMedia && isGeneratedMediaCaption(parsedContent.body)
                  ? null
                  : parsedContent.body;
              const hasBody = Boolean(bodyText);
              const quotePreview =
                getContentPreview(parsedContent.quote) ?? parsedContent.quote;
              const hasQuote = Boolean(quotePreview);
              const quotedMessage = hasQuote
                ? (findQuotedMessage(parsedContent.quote, item) ?? null)
                : null;
              const isHighlighted = highlightedMessageId === item.id;
              const showReadTick = item.id === latestOwnReadMessageId;
              return (
                <SwipeReplyRow
                  isMine={isMine}
                  message={item}
                  onReply={setReplyingTo}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onLongPress={() => setSelectedMessage(item)}
                    style={[
                      styles.messageBubble,
                      isMedia
                        ? styles.mediaBubble
                        : isMine
                          ? styles.mineBubble
                          : styles.otherBubble,
                      isHighlighted &&
                        (isMedia
                          ? styles.highlightedMediaBubble
                          : styles.highlightedMessageBubble),
                    ]}
                  >
                    {hasQuote ? (
                      <TouchableOpacity
                        activeOpacity={0.78}
                        onPress={() =>
                          handlePressQuote(parsedContent.quote, item)
                        }
                        style={[
                          styles.quotedMessage,
                          isMedia
                            ? styles.quotedMessageMedia
                            : isMine
                              ? styles.quotedMessageMine
                              : styles.quotedMessageOther,
                        ]}
                      >
                        <Text
                          style={[
                            styles.quotedLabel,
                            isMedia
                              ? styles.quotedLabelOther
                              : isMine
                                ? styles.quotedLabelMine
                                : styles.quotedLabelOther,
                          ]}
                        >
                          {getMessageSenderName(quotedMessage)}
                        </Text>
                        <Text
                          style={[
                            styles.quotedText,
                            isMedia
                              ? styles.quotedTextOther
                              : isMine
                                ? styles.quotedTextMine
                                : styles.quotedTextOther,
                          ]}
                          numberOfLines={2}
                        >
                          {quotePreview}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {isImage ? (
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setViewerMessage(item)}
                      >
                        <Image
                          source={{ uri: item.file_url! }}
                          style={styles.messageImage}
                          contentFit="cover"
                        />
                      </TouchableOpacity>
                    ) : isVideo ? (
                      <View style={styles.videoMessage}>
                        {Platform.OS === "web" && item.file_url ? (
                          <WebVideo
                            uri={item.file_url}
                            controls
                            style={styles.inlineVideo}
                          />
                        ) : (
                          <TouchableOpacity
                            style={styles.nativeVideoFallback}
                            onPress={() => setViewerMessage(item)}
                          >
                            <Ionicons name="play" size={32} color="#fff" />
                            <Text style={styles.nativeVideoText}>Video</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.videoOpenButton}
                          onPress={() => setViewerMessage(item)}
                        >
                          <Ionicons
                            name="expand-outline"
                            size={17}
                            color="#fff"
                          />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                    {hasBody ? (
                      <Text
                        style={[
                          styles.messageText,
                          isMedia && styles.mediaCaptionText,
                          isMedia &&
                            (isMine
                              ? styles.mediaCaptionMine
                              : styles.mediaCaptionOther),
                          isMine ? styles.mineText : styles.otherText,
                        ]}
                      >
                        {bodyText}
                      </Text>
                    ) : null}
                    <View style={styles.messageMetaRow}>
                      <Text
                        style={[
                          styles.messageTime,
                          isMedia
                            ? styles.mediaTime
                            : isMine
                              ? styles.mineTime
                              : styles.otherTime,
                        ]}
                      >
                        {formatTime(item.created_at)}
                      </Text>
                      {showReadTick ? (
                        <Ionicons
                          name="checkmark-done"
                          size={15}
                          color={CHAT_BLUE}
                          style={styles.readTick}
                        />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                </SwipeReplyRow>
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
                  <Ionicons
                    name="reorder-four-outline"
                    size={15}
                    color={Colors.light.tint}
                  />
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
                  {getReplyPreview(replyingTo)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Ionicons name="close" size={20} color="#777" />
              </TouchableOpacity>
            </View>
          ) : null}

          {selectedMedia.length > 0 ? (
            <View style={styles.mediaPreviewWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mediaPreviewContent}
              >
                {selectedMedia.map((asset, index) => (
                  <View
                    key={`${asset.uri}-${index}`}
                    style={styles.mediaPreviewItem}
                  >
                    {isVideoPickerAsset(asset) ? (
                      <View style={styles.videoPreview}>
                        <Ionicons name="play" size={24} color="#fff" />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: asset.uri }}
                        style={styles.mediaPreviewImage}
                        contentFit="cover"
                      />
                    )}
                    <TouchableOpacity
                      style={styles.removePreviewButton}
                      onPress={() =>
                        setSelectedMedia((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={[styles.composer, { paddingBottom: 8 }]}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setShowActions((current) => !current);
                setShowEmoji(false);
              }}
            >
              <Ionicons
                name={
                  showActions ? "close-circle-outline" : "add-circle-outline"
                }
                size={34}
                color="#6f6f6f"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleOpenProducts}
            >
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
            {draft.trim() || selectedMedia.length > 0 ? (
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
            <View
              style={[
                styles.actionPanel,
                { paddingBottom: 18 + Math.max(insets.bottom, 0) },
              ]}
            >
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
            <View
              style={[
                styles.emojiPanel,
                { paddingBottom: 18 + Math.max(insets.bottom, 0) },
              ]}
            >
              {STICKERS.map((sticker) => (
                <TouchableOpacity
                  key={sticker.label}
                  style={styles.stickerItem}
                  onPress={() => handleSend(sticker.label)}
                  disabled={sending}
                >
                  <Ionicons
                    name={sticker.icon}
                    size={42}
                    color={Colors.light.tint}
                  />
                  <Text style={styles.stickerLabel}>{sticker.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {!showActions && !showEmoji ? (
            <View style={{ height: Math.max(insets.bottom, 8) }} />
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
          <View
            style={[
              styles.messageActionSheet,
              { marginBottom: 14 + Math.max(insets.bottom, 0) },
            ]}
          >
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
                setDraft(getReplyPreview(selectedMessage));
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

      <Modal
        animationType="fade"
        visible={Boolean(viewerMessage)}
        onRequestClose={() => setViewerMessage(null)}
      >
        <SafeAreaView style={styles.mediaViewer}>
          <View style={styles.viewerTopBar}>
            <TouchableOpacity
              style={styles.viewerTopButton}
              onPress={() => setViewerMessage(null)}
            >
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.viewerSaveButton}
              onPress={handleSaveViewerMedia}
              disabled={savingMedia}
            >
              {savingMedia ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="download-outline" size={22} color="#fff" />
              )}
              <Text style={styles.viewerSaveText}>Lưu</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.viewerContent}>
            {viewerMessage?.file_url && isVideoMessage(viewerMessage) ? (
              Platform.OS === "web" ? (
                <WebVideo
                  uri={viewerMessage.file_url}
                  controls
                  autoPlay
                  style={styles.viewerVideo}
                />
              ) : (
                <TouchableOpacity
                  style={styles.viewerNativeVideo}
                  onPress={() =>
                    viewerMessage.file_url &&
                    Linking.openURL(viewerMessage.file_url)
                  }
                >
                  <Ionicons name="play-circle" size={64} color="#fff" />
                  <Text style={styles.viewerNativeVideoText}>
                    Nhấn để mở video
                  </Text>
                </TouchableOpacity>
              )
            ) : viewerMessage?.file_url ? (
              <Image
                source={{ uri: viewerMessage.file_url }}
                style={styles.viewerImage}
                contentFit="contain"
              />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="slide"
        visible={chatInfoVisible}
        onRequestClose={() => setChatInfoVisible(false)}
      >
        <SafeAreaView style={styles.infoScreen}>
          <View style={styles.infoTopBar}>
            <TouchableOpacity
              style={styles.infoBackButton}
              onPress={() => setChatInfoVisible(false)}
            >
              <Ionicons name="chevron-back" size={32} color="#111" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.infoScroll}
            contentContainerStyle={styles.infoContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.infoProfile}>
              {renderCircleAvatar(peerAvatarUri, title, 112)}
              <Text style={styles.infoName} numberOfLines={1}>
                {title}
              </Text>
            </View>

            <View style={styles.infoActions}>
              <TouchableOpacity
                style={styles.infoAction}
                onPress={() => {
                  setSearchQuery("");
                  setSearchVisible(true);
                }}
              >
                <View style={styles.infoActionIcon}>
                  <Ionicons name="search" size={24} color="#111" />
                </View>
                <Text style={styles.infoActionText}>Tìm kiếm</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.infoSectionTitle}>Thông tin về đoạn chat</Text>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.mediaSummaryCard}
              onPress={openMediaLibrary}
            >
              {latestMediaPreview.length > 0 ? (
                <View style={styles.mediaPreviewGrid}>
                  {latestMediaPreview.map((message) => (
                    <View key={message.id} style={styles.mediaPreviewTile}>
                      {message.file_url && message.message_type === "IMAGE" ? (
                        <Image
                          source={{ uri: message.file_url }}
                          style={styles.mediaPreviewTileImage}
                          contentFit="cover"
                        />
                      ) : message.file_url && isVideoMessage(message) ? (
                        <View style={styles.mediaPreviewVideoTile}>
                          {Platform.OS === "web" ? (
                            <WebVideo
                              uri={message.file_url}
                              muted
                              style={styles.mediaPreviewTileVideo}
                            />
                          ) : null}
                          <View style={styles.mediaPreviewPlay}>
                            <Ionicons name="play" size={18} color="#fff" />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyMediaPreview}>
                  <Ionicons name="images-outline" size={34} color="#9ca3af" />
                  <Text style={styles.emptyMediaText}>Chưa có phương tiện</Text>
                </View>
              )}
              <View style={styles.mediaSummaryRow}>
                <Ionicons name="folder-open-outline" size={24} color="#111" />
                <Text style={styles.mediaSummaryText}>
                  File phương tiện, liên kết và file
                </Text>
                <Ionicons name="chevron-forward" size={24} color="#777" />
              </View>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="slide"
        visible={mediaLibraryVisible}
        onRequestClose={() => setMediaLibraryVisible(false)}
      >
        <SafeAreaView style={styles.libraryScreen}>
          <View style={styles.libraryHeader}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setMediaLibraryVisible(false)}
            >
              <Ionicons name="arrow-back" size={28} color="#111" />
            </TouchableOpacity>
            <Text style={styles.libraryTitle}>File phương tiện</Text>
          </View>
          <FlatList
            data={visibleMediaMessages}
            keyExtractor={(item) => String(item.id)}
            numColumns={3}
            contentContainerStyle={styles.libraryGridContent}
            onEndReachedThreshold={0.35}
            onEndReached={() => {
              if (visibleMediaMessages.length < mediaMessages.length) {
                setMediaVisibleCount((current) => current + 10);
              }
            }}
            ListEmptyComponent={
              <View style={styles.libraryEmpty}>
                <Ionicons name="images-outline" size={42} color="#aaa" />
                <Text style={styles.emptyMediaText}>
                  Chưa có ảnh hoặc video
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.libraryTile}
                activeOpacity={0.86}
                onPress={() => setViewerMessage(item)}
              >
                {item.file_url && item.message_type === "IMAGE" ? (
                  <Image
                    source={{ uri: item.file_url }}
                    style={styles.libraryTileImage}
                    contentFit="cover"
                  />
                ) : item.file_url && isVideoMessage(item) ? (
                  <View style={styles.libraryVideoTile}>
                    {Platform.OS === "web" ? (
                      <WebVideo
                        uri={item.file_url}
                        muted
                        style={styles.libraryTileVideo}
                      />
                    ) : null}
                    <View style={styles.libraryVideoBadge}>
                      <Ionicons name="play" size={18} color="#fff" />
                    </View>
                  </View>
                ) : null}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="slide"
        visible={searchVisible}
        onRequestClose={() => setSearchVisible(false)}
      >
        <SafeAreaView style={styles.searchScreen}>
          <View style={styles.searchHeader}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setSearchVisible(false)}
            >
              <Ionicons name="arrow-back" size={28} color="#111" />
            </TouchableOpacity>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search" size={20} color="#777" />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                placeholder="Tìm kiếm tin nhắn"
                placeholderTextColor="#999"
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.searchResultContent}
            ListEmptyComponent={
              <View style={styles.searchEmpty}>
                <Ionicons name="search-outline" size={42} color="#aaa" />
                <Text style={styles.emptyMediaText}>
                  {searchQuery.trim()
                    ? "Không tìm thấy tin nhắn phù hợp"
                    : "Nhập nội dung cần tìm"}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultItem}
                activeOpacity={0.8}
                onPress={() => handleSelectSearchResult(item)}
              >
                <View style={styles.searchResultAvatar}>
                  <Text style={styles.searchResultAvatarText}>
                    {getMessageSenderName(item).slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.searchResultBody}>
                  <View style={styles.searchResultMeta}>
                    <Text style={styles.searchResultName} numberOfLines={1}>
                      {getMessageSenderName(item)}
                    </Text>
                    <Text style={styles.searchResultTime}>
                      {formatTime(item.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.searchResultText} numberOfLines={2}>
                    {getReplyPreview(item)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
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
    backgroundColor: "#e8f7f8",
    marginRight: 10,
  },
  storeAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#f2f2f2",
  },
  circleAvatarImage: {
    backgroundColor: "#e5e7eb",
  },
  circleAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CHAT_BLUE,
  },
  circleAvatarText: {
    color: "#fff",
    fontWeight: "800",
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
  swipeReplyHint: {
    position: "absolute",
    top: "50%",
    width: 34,
    height: 34,
    marginTop: -17,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CHAT_BLUE,
  },
  swipeReplyHintMine: {
    right: 8,
  },
  swipeReplyHintOther: {
    left: 8,
  },
  swipeMessageWrap: {
    maxWidth: "82%",
  },
  swipeMessageWrapMine: {
    alignItems: "flex-end",
  },
  swipeMessageWrapOther: {
    alignItems: "flex-start",
  },
  messageBubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  mineBubble: {
    backgroundColor: CHAT_MINE_BUBBLE,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ececec",
    borderBottomLeftRadius: 4,
  },
  highlightedMessageBubble: {
    borderWidth: 2,
    borderColor: CHAT_HIGHLIGHT,
  },
  mediaBubble: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: "transparent",
  },
  highlightedMediaBubble: {
    borderWidth: 2,
    borderRadius: 12,
    borderColor: CHAT_HIGHLIGHT,
    padding: 2,
  },
  quotedMessage: {
    marginBottom: 6,
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  quotedMessageMine: {
    borderLeftColor: QUOTE_ACCENT,
    backgroundColor: "rgba(255,255,255,0.78)",
  },
  quotedMessageOther: {
    borderLeftColor: QUOTE_ACCENT,
    backgroundColor: "#f5f5f5",
  },
  quotedMessageMedia: {
    borderLeftColor: QUOTE_ACCENT,
    backgroundColor: "#fff",
  },
  quotedLabel: {
    marginBottom: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  quotedLabelMine: {
    color: QUOTE_LABEL,
  },
  quotedLabelOther: {
    color: QUOTE_LABEL,
  },
  quotedText: {
    fontSize: 12,
    lineHeight: 16,
  },
  quotedTextMine: {
    color: "#536163",
  },
  quotedTextOther: {
    color: "#555",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  mediaCaptionText: {
    marginTop: 6,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: "hidden",
  },
  mediaCaptionMine: {
    backgroundColor: CHAT_MINE_BUBBLE,
  },
  mediaCaptionOther: {
    borderWidth: 1,
    borderColor: "#ececec",
    backgroundColor: "#fff",
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  videoMessage: {
    width: 230,
  },
  inlineVideo: {
    width: 230,
    height: 176,
    borderRadius: 10,
    backgroundColor: "#111",
    objectFit: "cover",
    overflow: "hidden",
  },
  nativeVideoFallback: {
    width: 230,
    height: 176,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  nativeVideoText: {
    marginTop: 8,
    color: "#fff",
    fontWeight: "700",
  },
  videoOpenButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.58)",
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
    color: "#202020",
  },
  otherText: {
    color: "#202020",
  },
  messageMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    alignSelf: "flex-end",
  },
  messageTime: {
    fontSize: 11,
  },
  readTick: {
    marginTop: 1,
  },
  mineTime: {
    color: "#7d8c8d",
  },
  otherTime: {
    color: "#999",
  },
  mediaTime: {
    color: "#8a8a8a",
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
    backgroundColor: QUOTE_ACCENT,
  },
  replyContent: {
    flex: 1,
    minWidth: 0,
  },
  replyLabel: {
    fontSize: 12,
    color: QUOTE_LABEL,
    fontWeight: "700",
  },
  replyText: {
    marginTop: 3,
    fontSize: 13,
    color: "#555",
  },
  mediaPreviewWrap: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f1f1f1",
  },
  mediaPreviewContent: {
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mediaPreviewItem: {
    width: 74,
    height: 74,
    borderRadius: 12,
  },
  mediaPreviewImage: {
    width: 74,
    height: 74,
    borderRadius: 12,
    backgroundColor: "#eee",
  },
  videoPreview: {
    width: 74,
    height: 74,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
  },
  removePreviewButton: {
    position: "absolute",
    top: -7,
    right: -7,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
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
  mediaViewer: {
    flex: 1,
    backgroundColor: "#050505",
  },
  viewerTopBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  viewerTopButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerSaveButton: {
    minWidth: 82,
    height: 40,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  viewerSaveText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  viewerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingBottom: 18,
  },
  viewerVideo: {
    width: "100%",
    maxWidth: 860,
    height: "78%",
    borderRadius: 8,
    backgroundColor: "#000",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
  },
  viewerNativeVideo: {
    width: "100%",
    maxWidth: 420,
    aspectRatio: 9 / 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  viewerNativeVideoText: {
    marginTop: 12,
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  infoScreen: {
    flex: 1,
    backgroundColor: "#f2f2f7",
  },
  infoTopBar: {
    minHeight: 48,
    justifyContent: "center",
  },
  infoBackButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  infoScroll: {
    flex: 1,
  },
  infoContent: {
    paddingHorizontal: 14,
    paddingBottom: 30,
  },
  infoProfile: {
    alignItems: "center",
    paddingTop: 8,
  },
  infoAvatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#e5e7eb",
  },
  infoAvatarFallback: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CHAT_BLUE,
  },
  infoName: {
    marginTop: 12,
    maxWidth: "90%",
    fontSize: 30,
    color: "#111",
    fontWeight: "800",
  },
  infoActions: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "center",
  },
  infoAction: {
    alignItems: "center",
    width: 92,
  },
  infoActionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dfe4e7",
  },
  infoActionText: {
    marginTop: 7,
    color: "#222",
    fontSize: 15,
    textAlign: "center",
  },
  infoSectionTitle: {
    marginTop: 28,
    marginBottom: 10,
    color: "#6b7280",
    fontSize: 20,
    fontWeight: "800",
  },
  mediaSummaryCard: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  mediaPreviewGrid: {
    minHeight: 176,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    padding: 10,
  },
  mediaPreviewTile: {
    width: "49%",
    aspectRatio: 1,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  mediaPreviewTileImage: {
    width: "100%",
    height: "100%",
  },
  mediaPreviewVideoTile: {
    flex: 1,
    backgroundColor: "#111",
  },
  mediaPreviewTileVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  mediaPreviewPlay: {
    position: "absolute",
    left: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  emptyMediaPreview: {
    minHeight: 116,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyMediaText: {
    color: "#777",
    fontSize: 14,
  },
  mediaSummaryRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
  },
  mediaSummaryText: {
    flex: 1,
    color: "#111",
    fontSize: 20,
    lineHeight: 25,
  },
  libraryScreen: {
    flex: 1,
    backgroundColor: "#f6f6f6",
  },
  libraryHeader: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ececec",
  },
  libraryTitle: {
    flex: 1,
    color: "#111",
    fontSize: 20,
    fontWeight: "800",
  },
  libraryGridContent: {
    padding: 4,
  },
  libraryTile: {
    flex: 1 / 3,
    aspectRatio: 1,
    padding: 3,
  },
  libraryTileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
  },
  libraryVideoTile: {
    flex: 1,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  libraryTileVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  libraryVideoBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  libraryEmpty: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  searchScreen: {
    flex: 1,
    backgroundColor: "#f6f6f6",
  },
  searchHeader: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ececec",
  },
  searchInputWrap: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    backgroundColor: "#eef0f2",
  },
  searchInput: {
    flex: 1,
    color: "#111",
    fontSize: 16,
  },
  searchResultContent: {
    paddingVertical: 8,
  },
  searchResultItem: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  searchResultAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CHAT_BLUE,
  },
  searchResultAvatarText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  searchResultBody: {
    flex: 1,
    minWidth: 0,
  },
  searchResultMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchResultName: {
    flex: 1,
    color: "#111",
    fontWeight: "800",
    fontSize: 14,
  },
  searchResultTime: {
    color: "#999",
    fontSize: 12,
  },
  searchResultText: {
    marginTop: 4,
    color: "#555",
    lineHeight: 19,
    fontSize: 14,
  },
  searchEmpty: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
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
