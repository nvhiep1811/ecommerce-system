// app/chat/[conversationId].tsx

import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { chatService, chatWs } from "@/services/chatService";
import type { Message, WsFrame } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
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
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatListener } from "@/hooks/use-chat-websocket";

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

interface MessageBubbleProps {
  msg: Message;
  isMine: boolean;
  colors: (typeof palette)["light"];
  onLongPress: () => void;
}

function MessageBubble({ msg, isMine, colors, onLongPress }: MessageBubbleProps) {
  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
      <Pressable
        onLongPress={onLongPress}
        style={[
          styles.bubble,
          isMine
            ? [styles.bubbleMine, { backgroundColor: colors.myBubble }]
            : [
                styles.bubbleOther,
                {
                  backgroundColor: colors.otherBubble,
                  borderColor: colors.otherBubbleBorder,
                },
              ],
        ]}
      >
        {/* Image message */}
        {msg.messageType === "IMAGE" && msg.fileUrl && (
          <Image
            source={{ uri: msg.fileUrl }}
            style={styles.msgImage}
            resizeMode="cover"
          />
        )}

        {/* File message */}
        {msg.messageType === "FILE" && (
          <View style={styles.fileRow}>
            <Ionicons
              name="document-outline"
              size={20}
              color={isMine ? colors.myBubbleText : colors.otherBubbleText}
            />
            <Text
              style={[
                styles.fileName,
                { color: isMine ? colors.myBubbleText : colors.otherBubbleText },
              ]}
              numberOfLines={1}
            >
              {msg.fileName ?? "Tệp"}
            </Text>
          </View>
        )}

        {/* Text message */}
        {msg.content && (
          <Text
            style={[
              styles.bubbleText,
              { color: isMine ? colors.myBubbleText : colors.otherBubbleText },
            ]}
          >
            {msg.content}
          </Text>
        )}

        <Text
          style={[
            styles.bubbleTime,
            {
              color: isMine
                ? "rgba(255,255,255,0.65)"
                : colors.time,
            },
          ]}
        >
          {formatTime(msg.createdAt)}
          {isMine && (
            <Text> {msg.read ? "✓✓" : "✓"}</Text>
          )}
        </Text>
      </Pressable>
    </View>
  );
}

function DateDivider({ date, color }: { date: string; color: string }) {
  return (
    <View style={styles.dateDivider}>
      <View style={[styles.dateLine, { backgroundColor: color }]} />
      <Text style={[styles.dateText, { color }]}>{date}</Text>
      <View style={[styles.dateLine, { backgroundColor: color }]} />
    </View>
  );
}

export default function ChatRoomScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const convId = parseInt(conversationId, 10);
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? palette.dark : palette.light;
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const currentUserId = profile?.id ?? "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load lịch sử tin nhắn
  useEffect(() => {
    loadMessages();
    chatService.markAsRead(convId);
    chatWs.markRead(convId);
  }, [convId]);

  const loadMessages = async () => {
    try {
      const res = await chatService.getMessages(convId);
      // API trả về DESC, reverse lại để hiển thị cũ → mới
      setMessages(res.content.slice().reverse());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Lắng nghe WebSocket
  useChatListener(
    useCallback(
      (frame: WsFrame) => {
        if (frame.type === "NEW_MESSAGE") {
          const msg: Message = frame.payload;
          if (msg.conversationId !== convId) return;
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Đánh dấu đọc ngay nếu là tin của đối phương
          if (msg.senderId !== currentUserId) {
            chatWs.markRead(convId);
          }
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
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

  // Xử lý typing indicator
  const handleInputChange = (text: string) => {
    setInputText(text);
    if (!isTyping) {
      setIsTyping(true);
      chatWs.sendTyping(convId, true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
      chatWs.sendTyping(convId, false);
    }, 2000);
  };

  // Gửi tin nhắn text
  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    chatWs.sendMessage(convId, text);
    setInputText("");
    if (typingTimer.current) clearTimeout(typingTimer.current);
    chatWs.sendTyping(convId, false);
    setIsTyping(false);
  };

  // Upload ảnh
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Quyền truy cập", "Cần quyền truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const fileName = asset.uri.split("/").pop() ?? "image.jpg";
    setUploading(true);
    try {
      const uploaded = await chatService.uploadFile({
        uri: asset.uri,
        name: fileName,
        type: asset.mimeType ?? "image/jpeg",
      });
      chatWs.sendImageMessage(convId, uploaded.fileUrl, uploaded.fileName, uploaded.fileSize);
    } catch {
      Alert.alert("Lỗi", "Không thể gửi ảnh. Vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  };

  // Long press xóa tin nhắn
  const handleLongPress = (msg: Message) => {
    if (msg.senderId !== currentUserId) return;
    Alert.alert("Xóa tin nhắn", "Bạn có chắc muốn xóa tin nhắn này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          await chatService.deleteMessage(msg.id);
          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        },
      },
    ]);
  };

  // Group messages theo ngày để hiển thị divider
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

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
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
        <View style={[styles.headerAvatar, { backgroundColor: Colors.light.tint + "20" }]}>
          <Text style={[styles.headerAvatarText, { color: Colors.light.tint }]}>
            CH
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.inputText }]} numberOfLines={1}>
            Cuộc trò chuyện #{convId}
          </Text>
          {otherTyping && (
            <Text style={[styles.typingIndicator, { color: colors.typing }]}>
              đang nhập...
            </Text>
          )}
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={renderedItems}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.type === "date") {
            return <DateDivider date={item.date} color={colors.time} />;
          }
          const isMine = item.msg.senderId === currentUserId;
          return (
            <MessageBubble
              msg={item.msg}
              isMine={isMine}
              colors={colors}
              onLongPress={() => handleLongPress(item.msg)}
            />
          );
        }}
        contentContainerStyle={styles.messageList}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Typing indicator */}
      {otherTyping && (
        <View style={[styles.typingRow, { backgroundColor: colors.bg }]}>
          <View style={[styles.typingBubble, { backgroundColor: colors.otherBubble, borderColor: colors.otherBubbleBorder }]}>
            <Text style={[styles.typingDots, { color: colors.typing }]}>●●●</Text>
          </View>
        </View>
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
        {/* Attach image */}
        <Pressable
          onPress={handlePickImage}
          disabled={uploading}
          style={styles.attachBtn}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={Colors.light.tint} />
          ) : (
            <Ionicons name="image-outline" size={24} color={colors.attachBtn} />
          )}
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

        {/* Send button */}
        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || uploading}
          style={[
            styles.sendBtn,
            {
              backgroundColor:
                inputText.trim() ? colors.sendBtn : colors.sendBtnDisabled,
            },
          ]}
        >
          <Ionicons name="send" size={18} color="#ffffff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
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

  // Messages
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
  fileRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fileName: { fontSize: 14, flex: 1 },

  // Date divider
  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    gap: 8,
  },
  dateLine: { flex: 1, height: 1, opacity: 0.3 },
  dateText: { fontSize: 12 },

  // Typing
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

  // Input bar
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
});
