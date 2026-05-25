// app/chat/[conversationId].tsx

import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { chatService, chatWs } from "@/services/chatService";
import { uploadChatFile } from "@/services/chatUploadService";
import type { Message, WsFrame } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import EmojiKeyboard, { type EmojiType } from "rn-emoji-keyboard";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatListener } from "@/hooks/use-chat-websocket";

// ─── Palette ──────────────────────────────────────────────────────────────────
const palette = {
  light: {
    bg: "#f8f8f8",
    headerBg: "#ffffff",
    headerBorder: "#f0f0f0",
    myBubble: Colors.light.tint,
    myBubbleText: "#ffffff",
    otherBubble: "#ffffff",
    otherBubbleText: "#11181C",
    otherBubbleBorder: "#e5e7eb",
    inputBg: "#ffffff",
    inputBorder: "#e5e7eb",
    inputText: "#11181C",
    inputPlaceholder: "#9ca3af",
    sendBtn: Colors.light.tint,
    sendBtnDisabled: "#e5e7eb",
    time: "#9ca3af",
    typing: "#6b7280",
    attachBtn: "#6b7280",
  },
  dark: {
    bg: "#151718",
    headerBg: "#1e2022",
    headerBorder: "#2a2d2f",
    myBubble: Colors.light.tint,
    myBubbleText: "#ffffff",
    otherBubble: "#2a2d2f",
    otherBubbleText: "#ECEDEE",
    otherBubbleBorder: "#3a3d3f",
    inputBg: "#1e2022",
    inputBorder: "#2a2d2f",
    inputText: "#ECEDEE",
    inputPlaceholder: "#6b7280",
    sendBtn: Colors.light.tint,
    sendBtnDisabled: "#2a2d2f",
    time: "#6b7280",
    typing: "#9BA1A6",
    attachBtn: "#9BA1A6",
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface PendingMessage {
  tempId: string;
  localUri: string;
  type: "IMAGE" | "VIDEO" | "FILE";
  fileName?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hôm nay";
  if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return date.toLocaleDateString("vi-VN");
}

// ─── AttachmentSheet ──────────────────────────────────────────────────────────
interface AttachmentSheetProps {
  visible: boolean;
  colors: (typeof palette)["light"];
  onClose: () => void;
  onPickImage: () => void;
  onTakePhoto: () => void;
  onPickVideo: () => void;
  onPickFile: () => void;
  isUploading: boolean;
}

function AttachmentSheet({
  visible,
  colors,
  onClose,
  onPickImage,
  onTakePhoto,
  onPickVideo,
  onPickFile,
  isUploading,
}: AttachmentSheetProps) {
  const translateY = useSharedValue(300);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(300, { duration: 200 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  const options = [
    {
      icon: "image-outline" as const,
      label: "Thư viện",
      color: "#E1F5EE",
      iconColor: "#0F6E56",
      onPress: onPickImage,
    },
    {
      icon: "camera-outline" as const,
      label: "Camera",
      color: "#E6F1FB",
      iconColor: "#185FA5",
      onPress: onTakePhoto,
    },
    {
      icon: "videocam-outline" as const,
      label: "Video",
      color: "#FAEEDA",
      iconColor: "#854F0B",
      onPress: onPickVideo,
    },
    {
      icon: "document-outline" as const,
      label: "File",
      color: "#EEEDFE",
      iconColor: "#534AB7",
      onPress: onPickFile,
    },
  ];

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(0,0,0,0.45)" },
            overlayStyle,
          ]}
        />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[styles.sheet, { backgroundColor: colors.headerBg }, sheetStyle]}
      >
        <View style={styles.sheetHandle} />
        <Text style={[styles.sheetTitle, { color: colors.time }]}>
          Đính kèm
        </Text>

        <View style={styles.sheetGrid}>
          {options.map((opt) => (
            <Pressable
              key={opt.label}
              style={styles.sheetItem}
              onPress={() => {
                onClose();
                setTimeout(opt.onPress, 300);
              }}
              disabled={isUploading}
            >
              <View style={[styles.sheetIcon, { backgroundColor: opt.color }]}>
                <Ionicons name={opt.icon} size={28} color={opt.iconColor} />
              </View>
              <Text style={[styles.sheetLabel, { color: colors.inputText }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.sheetCancel, { borderTopColor: colors.headerBorder }]}
          onPress={onClose}
        >
          <Text style={{ color: Colors.light.tint, fontSize: 16 }}>Hủy</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── Pending Bubbles ──────────────────────────────────────────────────────────
function PendingImageBubble({
  localUri,
  colors,
}: {
  localUri: string;
  colors: (typeof palette)["light"];
}) {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowMine]}>
      <View
        style={[
          styles.bubble,
          styles.bubbleMine,
          { backgroundColor: colors.myBubble, padding: 4 },
        ]}
      >
        <View style={styles.pendingImageWrap}>
          <Image
            source={{ uri: localUri }}
            style={styles.msgImage}
            resizeMode="cover"
          />
          <View style={styles.pendingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        </View>
        <Text
          style={[
            styles.bubbleTime,
            { color: "rgba(255,255,255,0.65)", marginTop: 4 },
          ]}
        >
          Đang gửi...
        </Text>
      </View>
    </View>
  );
}

function PendingVideoBubble({
  localUri,
  colors,
}: {
  localUri: string;
  colors: (typeof palette)["light"];
}) {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowMine]}>
      <View
        style={[
          styles.bubble,
          styles.bubbleMine,
          { backgroundColor: colors.myBubble, padding: 4 },
        ]}
      >
        <View style={styles.pendingImageWrap}>
          {Platform.OS === "web" ? (
            <video
              src={localUri}
              style={{ width: 200, height: 160, borderRadius: 12, objectFit: "cover" }}
              muted
              preload="metadata"
            />
          ) : (
            <Video
              source={{ uri: localUri }}
              style={styles.msgImage}
              resizeMode={ResizeMode.COVER}
              isMuted
            />
          )}
          <View style={styles.pendingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
          </View>
        </View>
        <Text
          style={[
            styles.bubbleTime,
            { color: "rgba(255,255,255,0.65)", marginTop: 4 },
          ]}
        >
          Đang gửi...
        </Text>
      </View>
    </View>
  );
}

function PendingFileBubble({
  fileName,
  colors,
}: {
  fileName: string;
  colors: (typeof palette)["light"];
}) {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowMine]}>
      <View
        style={[styles.bubble, styles.bubbleMine, { backgroundColor: colors.myBubble }]}
      >
        <View style={styles.fileRow}>
          <ActivityIndicator size="small" color="#fff" />
          <Text
            style={[styles.fileName, { color: "#fff" }]}
            numberOfLines={1}
          >
            {fileName}
          </Text>
        </View>
        <Text style={[styles.bubbleTime, { color: "rgba(255,255,255,0.65)" }]}>
          Đang gửi...
        </Text>
      </View>
    </View>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────
interface MessageBubbleProps {
  msg: Message;
  isMine: boolean;
  colors: (typeof palette)["light"];
  currentUserId: string;          // ← thêm
  onLongPress: () => void;
  onReply: () => void;            // ← thêm
}

function MessageBubble({ msg, isMine, colors, currentUserId, onLongPress, onReply }: MessageBubbleProps) {
  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
      <Pressable
        onLongPress={onLongPress}
        onPress={onReply}          // ← single tap để reply (hoặc dùng swipe nếu muốn)
        style={[
          styles.bubble,
          isMine
            ? [styles.bubbleMine, { backgroundColor: colors.myBubble }]
            : [styles.bubbleOther, { backgroundColor: colors.otherBubble, borderColor: colors.otherBubbleBorder }],
        ]}
      >
        {/* Reply preview */}
        {msg.replyToMessage && (
          <ReplyPreview
            reply={msg.replyToMessage}
            isMine={isMine}
            currentUserId={currentUserId}
            colors={colors}
          />
        )}

        {/* Ảnh */}
        {msg.messageType === "IMAGE" && msg.fileUrl && (
          <Image source={{ uri: msg.fileUrl }} style={styles.msgImage} resizeMode="cover" />
        )}

        {/* Video */}
        {msg.messageType === "VIDEO" && msg.fileUrl && (
          Platform.OS === "web" ? (
            <video
              src={msg.fileUrl}
              style={{ width: 200, height: 160, borderRadius: 12, objectFit: "cover" }}
              controls
              preload="metadata"
            />
          ) : (
            <Video source={{ uri: msg.fileUrl }} style={styles.msgImage} resizeMode={ResizeMode.COVER} useNativeControls />
          )
        )}

        {/* File */}
        {msg.messageType === "FILE" && (
          <View style={styles.fileRow}>
            <Ionicons name="document-outline" size={20} color={isMine ? colors.myBubbleText : colors.otherBubbleText} />
            <Text style={[styles.fileName, { color: isMine ? colors.myBubbleText : colors.otherBubbleText }]} numberOfLines={1}>
              {msg.fileName ?? "Tệp"}
            </Text>
          </View>
        )}

        {/* Text */}
        {msg.content && (
          <Text style={[styles.bubbleText, { color: isMine ? colors.myBubbleText : colors.otherBubbleText }]}>
            {msg.content}
          </Text>
        )}

        <Text style={[styles.bubbleTime, { color: isMine ? "rgba(255,255,255,0.65)" : colors.time }]}>
          {formatTime(msg.createdAt)}
          {isMine && <Text> {msg.read ? "✓✓" : "✓"}</Text>}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── DateDivider ──────────────────────────────────────────────────────────────
function DateDivider({ date, color }: { date: string; color: string }) {
  return (
    <View style={styles.dateDivider}>
      <View style={[styles.dateLine, { backgroundColor: color }]} />
      <Text style={[styles.dateText, { color }]}>{date}</Text>
      <View style={[styles.dateLine, { backgroundColor: color }]} />
    </View>
  );
}

// ─── ReplyPreview ──────────────────────────────────────────────────────────────
function ReplyPreview({
  reply,
  isMine,
  currentUserId,
  colors,
}: {
  reply: NonNullable<Message["replyToMessage"]>;
  isMine: boolean;
  currentUserId: string;
  colors: (typeof palette)["light"];
}) {
  const isMyReply = reply.senderId === currentUserId;
  const bubbleBg = isMine ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.06)";
  const accentColor = Colors.light.tint;
  const textColor = isMine ? "#fff" : colors.otherBubbleText;

  const previewText =
    reply.messageType === "IMAGE" ? "🖼 Hình ảnh" :
    reply.messageType === "VIDEO" ? "🎥 Video" :
    reply.messageType === "FILE"  ? `📄 ${reply.fileName ?? "Tệp"}` :
    reply.content ?? "";

  return (
    <View style={[styles.replyPreview, { backgroundColor: bubbleBg, borderLeftColor: accentColor }]}>
      <Text style={[styles.replyName, { color: accentColor }]}>
        {isMyReply ? "Bạn" : "Đối phương"}
      </Text>
      <Text style={[styles.replyText, { color: textColor }]} numberOfLines={1}>
        {previewText}
      </Text>
    </View>
  );
}

// ─── ReplyBar ──────────────────────────────────────────────────────────────
function ReplyBar({
  message,
  currentUserId,
  colors,
  onCancel,
}: {
  message: Message;
  currentUserId: string;
  colors: (typeof palette)["light"];
  onCancel: () => void;
}) {
  const isMyMsg = message.senderId === currentUserId;
  const previewText =
    message.messageType === "IMAGE" ? "🖼 Hình ảnh" :
    message.messageType === "VIDEO" ? "🎥 Video" :
    message.messageType === "FILE"  ? `📄 ${message.fileName ?? "Tệp"}` :
    message.content ?? "";

  return (
    <View style={[styles.replyBar, { backgroundColor: colors.inputBg, borderTopColor: colors.headerBorder }]}>
      <View style={[styles.replyBarAccent, { backgroundColor: Colors.light.tint }]} />
      <View style={styles.replyBarContent}>
        <Text style={[styles.replyBarName, { color: Colors.light.tint }]}>
          {isMyMsg ? "Bạn" : "Đối phương"}
        </Text>
        <Text style={[styles.replyBarText, { color: colors.inputText }]} numberOfLines={1}>
          {previewText}
        </Text>
      </View>
      <Pressable onPress={onCancel} style={styles.replyBarClose}>
        <Ionicons name="close" size={18} color={colors.attachBtn} />
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ChatRoomScreen() {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const { conversationId, sellerId, productId } = useLocalSearchParams<{
    conversationId?: string;
    sellerId?: string;
    productId?: string;
  }>();

  const convId =
    conversationId && conversationId !== "new" ? Number(conversationId) : NaN;
  const isValidConv = !Number.isNaN(convId);

  useEffect(() => {
    if (conversationId !== "new") return;
    chatService
      .startConversation(sellerId as string, Number(productId))
      .then((res) => {
        router.replace({
          pathname: "/chat/[conversationId]",
          params: { conversationId: res.id.toString() },
        });
      });
  }, [conversationId, sellerId, productId]);

  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? palette.dark : palette.light;
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const currentUserId = profile?.id ?? "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load tin nhắn ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isValidConv) return;
    loadMessages();
    chatService.markAsRead(convId);
    chatWs.markRead(convId);
  }, [convId]);

  const loadMessages = async () => {
    if (Number.isNaN(convId)) return;
    try {
      const res = await chatService.getMessages(convId);
      setMessages(res.content.slice().reverse());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ─── WebSocket listener ──────────────────────────────────────────────────────
  useChatListener(
    useCallback(
      (frame: WsFrame) => {
        if (frame.type === "NEW_MESSAGE") {
          const msg: Message = frame.payload;
          console.log("[WS] NEW_MESSAGE:", JSON.stringify(msg));
          if (msg.conversationId !== convId) return;
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.senderId !== currentUserId) chatWs.markRead(convId);
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            100
          );
        }
        if (frame.type === "MESSAGE_READ") {
          if (frame.payload.conversationId !== convId) return;
          setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
        }
        if (frame.type === "MESSAGE_DELETED") {
          if (frame.payload.conversationId !== convId) return;
          setMessages((prev) =>
            prev.filter((m) => m.id !== frame.payload.messageId)
          );
        }
        if (frame.type === "TYPING_INDICATOR") {
          if (frame.payload.conversationId !== convId) return;
          if (frame.payload.userId === currentUserId) return;
          setOtherTyping(frame.payload.isTyping);
        }
      },
      [convId, currentUserId]
    )
  );

  // ─── Typing ──────────────────────────────────────────────────────────────────
  const handleInputChange = (text: string) => {
    setInputText(text);
    chatWs.sendTyping(convId, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      chatWs.sendTyping(convId, false);
    }, 2000);
  };

  // ─── Gửi text ────────────────────────────────────────────────────────────────
  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    chatWs.send("SEND_MESSAGE", {
      conversationId: convId,
      content: text,
      messageType: "TEXT",
      replyToMessageId: replyingTo?.id ?? null,
    });
    setInputText("");
    setReplyingTo(null);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    chatWs.sendTyping(convId, false);
  };

  // ─── Upload helper dùng chung ─────────────────────────────────────────────
  const uploadMedia = async (
    uri: string,
    type: "IMAGE" | "VIDEO",
    mimeType: string
  ) => {
    const tempId = `pending-${Date.now()}`;
    setPendingMessages((prev) => [...prev, { tempId, localUri: uri, type }]);
    setTimeout(
      () => flatListRef.current?.scrollToEnd({ animated: true }),
      100
    );
    try {
      const uploaded = await uploadChatFile({
        uri,
        name: uri.split("/").pop() ?? "file",
        type: mimeType,
      });
      chatWs.send("SEND_MESSAGE", {
        conversationId: convId,
        messageType: type,   // "IMAGE" hoặc "VIDEO"
        fileUrl: uploaded.fileUrl,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
      });
    } catch (e: any) {
      Alert.alert("Lỗi", e.message ?? "Không thể gửi. Vui lòng thử lại.");
    } finally {
      setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId));
    }
  };

  // ─── Chọn ảnh từ thư viện ────────────────────────────────────────────────
  const handlePickImage = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Quyền truy cập", "Cần quyền truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadMedia(asset.uri, "IMAGE", asset.mimeType ?? "image/jpeg");
  };

  // ─── Chụp ảnh bằng camera ────────────────────────────────────────────────
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Quyền truy cập", "Cần quyền camera");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadMedia(asset.uri, "IMAGE", asset.mimeType ?? "image/jpeg");
  };

  // ─── Chọn video ──────────────────────────────────────────────────────────
  const handlePickVideo = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Quyền truy cập", "Cần quyền thư viện");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
      videoMaxDuration: 300,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadMedia(asset.uri, "VIDEO", asset.mimeType ?? "video/mp4");
  };

  // ─── Chọn file ───────────────────────────────────────────────────────────
  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const tempId = `pending-${Date.now()}`;

    setPendingMessages((prev) => [
      ...prev,
      { tempId, localUri: asset.uri, type: "FILE", fileName: asset.name },
    ]);
    setTimeout(
      () => flatListRef.current?.scrollToEnd({ animated: true }),
      100
    );
    try {
      const uploaded = await uploadChatFile({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "application/octet-stream",
      });
      chatWs.send("SEND_MESSAGE", {
        conversationId: convId,
        messageType: "FILE",
        fileUrl: uploaded.fileUrl,
        fileName: uploaded.fileName,
        fileSize: uploaded.fileSize,
      });
    } catch (e: any) {
      Alert.alert("Lỗi", e.message ?? "Không thể gửi file.");
    } finally {
      setPendingMessages((prev) => prev.filter((p) => p.tempId !== tempId));
    }
  };

  // ─── Long press xóa hỗ trợ reply ──────────────────────────────────────────────────────
  const handleLongPress = (msg: Message) => {
    if (msg.senderId === currentUserId) {
      Alert.alert("Tin nhắn", undefined, [
        { text: "Trả lời", onPress: () => setReplyingTo(msg) },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            await chatService.deleteMessage(msg.id);
            setMessages((prev: Message[]) => prev.filter((m: Message) => m.id !== msg.id));
          },
        },
        { text: "Hủy", style: "cancel" },
      ]);
    } else {
      Alert.alert("Tin nhắn", undefined, [
        { text: "Trả lời", onPress: () => setReplyingTo(msg) },
        { text: "Hủy", style: "cancel" },
      ]);
    }
  };

  // ─── Group theo ngày ─────────────────────────────────────────────────────
  const renderedItems = useMemo(() => {
    type Item =
      | { type: "date"; date: string; key: string }
      | { type: "message"; msg: Message; key: string };
    const result: Item[] = [];
    let lastDate = "";
    for (const msg of messages) {
      const d = formatDate(msg.createdAt);
      if (d !== lastDate) {
        result.push({ type: "date", date: d, key: `date-${d}` });
        lastDate = d;
      }
      result.push({ type: "message", msg, key: `msg-${msg.id}` });
    }
    return result;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  // ─── Loading state ────────────────────────────────────────────────────────
  if (conversationId === "new") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
    <EmojiKeyboard
      onEmojiSelected={(emoji: EmojiType) =>
        setInputText((prev) => prev + emoji.emoji)
      }
      open={emojiOpen}
      onClose={() => setEmojiOpen(false)}
      theme={{
        backdrop: "rgba(0,0,0,0.3)",
        knob: Colors.light.tint,
        header: colors.inputText,
        category: {
          icon: colors.attachBtn,
          iconActive: Colors.light.tint,
          container: colors.headerBg,
          containerActive: colors.headerBg,
        },
        search: {
          text: colors.inputText,
          placeholder: colors.inputPlaceholder,
          icon: colors.attachBtn,
          background: colors.inputBg,
        },
        emoji: {
          selected: colors.inputBg,
        },
        container: colors.headerBg,
        skinTonesContainer: colors.headerBg,
      }}
    />

    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.headerBg,
            borderBottomColor: colors.headerBorder,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.inputText} />
        </Pressable>
        <View
          style={[
            styles.headerAvatar,
            { backgroundColor: Colors.light.tint + "20" },
          ]}
        >
          <Text
            style={[styles.headerAvatarText, { color: Colors.light.tint }]}
          >
            CH
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text
            style={[styles.headerName, { color: colors.inputText }]}
            numberOfLines={1}
          >
            Cuộc trò chuyện #{convId}
          </Text>
          {otherTyping && (
            <Text
              style={[styles.typingIndicator, { color: colors.typing }]}
            >
              đang nhập...
            </Text>
          )}
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={renderedItems}
        extraData={[messages, pendingMessages]}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.type === "date")
            return <DateDivider date={item.date} color={colors.time} />;
          const msg = item.msg;
          if (!msg) return null;
          return (
            <MessageBubble
              msg={msg}
              isMine={msg.senderId === currentUserId}
              colors={colors}
              currentUserId={currentUserId}
              onLongPress={() => handleLongPress(msg)}
              onReply={() => setReplyingTo(msg)}
            />
          );
        }}
        ListFooterComponent={
          <>
            {pendingMessages.map((p) => {
              if (p.type === "IMAGE")
                return (
                  <PendingImageBubble
                    key={p.tempId}
                    localUri={p.localUri}
                    colors={colors}
                  />
                );
              if (p.type === "VIDEO")
                return (
                  <PendingVideoBubble
                    key={p.tempId}
                    localUri={p.localUri}
                    colors={colors}
                  />
                );
              return (
                <PendingFileBubble
                  key={p.tempId}
                  fileName={p.fileName ?? "Tệp"}
                  colors={colors}
                />
              );
            })}
            {otherTyping && (
              <View
                style={[styles.typingRow, { backgroundColor: colors.bg }]}
              >
                <View
                  style={[
                    styles.typingBubble,
                    {
                      backgroundColor: colors.otherBubble,
                      borderColor: colors.otherBubbleBorder,
                    },
                  ]}
                >
                  <Text
                    style={[styles.typingDots, { color: colors.typing }]}
                  >
                    ●●●
                  </Text>
                </View>
              </View>
            )}
          </>
        }
        contentContainerStyle={styles.messageList}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.center}>
              <Text style={{ color: colors.time, marginTop: 40 }}>
                Hãy bắt đầu cuộc trò chuyện! 👋
              </Text>
            </View>
          ) : null
        }
      />

      {/* Reply bar */}
      {replyingTo && (
        <ReplyBar
          message={replyingTo}
          currentUserId={currentUserId}
          colors={colors}
          onCancel={() => setReplyingTo(null)}
        />
      )}

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.headerBg,
            borderTopColor: colors.headerBorder,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        {/* Nút đính kèm */}
        <Pressable
          onPress={() => setSheetVisible(true)}
          disabled={pendingMessages.length > 0}
          style={styles.attachBtn}
        >
          {pendingMessages.length > 0 ? (
            <ActivityIndicator size="small" color={Colors.light.tint} />
          ) : (
            <Ionicons
              name="add-circle-outline"
              size={26}
              color={colors.attachBtn}
            />
          )}
        </Pressable>

        <Pressable
          onPress={() => setEmojiOpen((v) => !v)}
          style={styles.attachBtn}
        >
          <Text style={{ fontSize: 22 }}>😊</Text>
        </Pressable>

        {/* Text input */}
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
              color: colors.inputText,
            },
          ]}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor={colors.inputPlaceholder}
          value={inputText}
          onChangeText={handleInputChange}
          multiline
          maxLength={5000}
          returnKeyType="default"
        />

        {/* Nút gửi */}
        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim()}
          style={[
            styles.sendBtn,
            {
              backgroundColor: inputText.trim()
                ? colors.sendBtn
                : colors.sendBtnDisabled,
            },
          ]}
        >
          <Ionicons name="send" size={18} color="#ffffff" />
        </Pressable>
      </View>

      {/* Attachment Sheet */}
      <AttachmentSheet
        visible={sheetVisible}
        colors={colors}
        onClose={() => setSheetVisible(false)}
        onPickImage={handlePickImage}
        onTakePhoto={handleTakePhoto}
        onPickVideo={handlePickVideo}
        onPickFile={handlePickFile}
        isUploading={pendingMessages.length > 0}
      />
    </KeyboardAvoidingView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { fontSize: 14, fontWeight: "700" },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: "600" },
  typingIndicator: { fontSize: 12, fontStyle: "italic" },
  messageList: { paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  bubbleRow: { flexDirection: "row", marginVertical: 2 },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowOther: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 4,
  },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTime: { fontSize: 11, alignSelf: "flex-end" },
  msgImage: { width: 200, height: 160, borderRadius: 12 },
  pendingImageWrap: { position: "relative" },
  pendingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fileName: { fontSize: 14, flex: 1 },
  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    gap: 8,
  },
  dateLine: { flex: 1, height: 1, opacity: 0.3 },
  dateText: { fontSize: 12 },
  typingRow: { paddingHorizontal: 16, paddingBottom: 4 },
  typingBubble: {
    alignSelf: "flex-start",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  typingDots: { fontSize: 10, letterSpacing: 2 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  attachBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 15,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  // Attachment sheet
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e5e7eb",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 12, textAlign: "center", marginBottom: 20 },
  sheetGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sheetItem: { alignItems: "center", gap: 8, width: 72 },
  sheetIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetLabel: { fontSize: 12 },
  sheetCancel: {
    borderTopWidth: 0.5,
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 16,
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  replyName: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  replyText: { fontSize: 12, opacity: 0.85 },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  replyBarAccent: { width: 3, height: 36, borderRadius: 2 },
  replyBarContent: { flex: 1 },
  replyBarName: { fontSize: 12, fontWeight: "600" },
  replyBarText: { fontSize: 13, opacity: 0.8 },
  replyBarClose: { padding: 4 },
});