// app/(tabs)/chat/index.tsx  (hoặc app/chat/index.tsx tùy routing của bạn)

import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { chatService, chatWs } from "@/services/chatService";
import type { Conversation, WsFrame } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useChatListener } from "@/hooks/use-chat-websocket";

const palette = {
  light: {
    bg: "#f8f8f8",
    card: "#ffffff",
    border: "#f0f0f0",
    text: "#11181C",
    subtext: "#6b7280",
    unreadBadge: Colors.light.tint,
    unreadText: "#ffffff",
    empty: "#9ca3af",
    separator: "#f3f4f6",
    headerBg: "#ffffff",
    online: "#22c55e",
  },
  dark: {
    bg: "#151718",
    card: "#1e2022",
    border: "#2a2d2f",
    text: "#ECEDEE",
    subtext: "#9BA1A6",
    unreadBadge: Colors.light.tint,
    unreadText: "#ffffff",
    empty: "#6b7280",
    separator: "#2a2d2f",
    headerBg: "#151718",
    online: "#22c55e",
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ngày`;
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

function getInitials(id: string): string {
  return id.slice(0, 2).toUpperCase();
}

interface ConversationItemProps {
  item: Conversation;
  currentUserId: string;
  colors: (typeof palette)["light"];
  onPress: () => void;
}

function ConversationItem({
  item,
  currentUserId,
  colors,
  onPress,
}: ConversationItemProps) {
  const isCustomer = item.customerId === currentUserId;
  const otherId = isCustomer ? item.sellerId : item.customerId;
  const lastMsg = item.lastMessage;
  const hasUnread = item.unreadCount > 0;

  const previewText = () => {
    if (!lastMsg) return "Chưa có tin nhắn";
    if (lastMsg.messageType === "IMAGE") return "📷 Hình ảnh";
    if (lastMsg.messageType === "FILE") return `📎 ${lastMsg.fileName ?? "Tệp"}`;
    return lastMsg.content ?? "";
  };

  const isMine = lastMsg?.senderId === currentUserId;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.convItem,
        { backgroundColor: colors.card },
        pressed && { opacity: 0.85 },
      ]}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: Colors.light.tint + "20" }]}>
        <Text style={[styles.avatarText, { color: Colors.light.tint }]}>
          {getInitials(otherId)}
        </Text>
        {/* Online dot placeholder */}
      </View>

      {/* Content */}
      <View style={styles.convContent}>
        <View style={styles.convTopRow}>
          <Text
            style={[
              styles.convName,
              { color: colors.text },
              hasUnread && styles.convNameBold,
            ]}
            numberOfLines={1}
          >
            {isCustomer ? "Người bán" : "Khách hàng"}
            {item.productId ? ` · #${item.productId}` : ""}
          </Text>
          <Text style={[styles.convTime, { color: colors.subtext }]}>
            {lastMsg ? timeAgo(lastMsg.createdAt) : ""}
          </Text>
        </View>

        <View style={styles.convBottomRow}>
          <Text
            style={[
              styles.convPreview,
              { color: hasUnread ? colors.text : colors.subtext },
              hasUnread && styles.convPreviewBold,
            ]}
            numberOfLines={1}
          >
            {isMine ? "Bạn: " : ""}
            {previewText()}
          </Text>

          {hasUnread && (
            <View style={[styles.badge, { backgroundColor: colors.unreadBadge }]}>
              <Text style={[styles.badgeText, { color: colors.unreadText }]}>
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function ConversationListScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === "dark" ? palette.dark : palette.light;
  const { profile } = useAuth();
  const currentUserId = profile?.id ?? "";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const role = (profile as any)?.roles?.includes("SELLER") ? "SELLER" : "CUSTOMER";

  const fetchConversations = useCallback(async () => {
    try {
      const res = await chatService.getConversations(role);
      setConversations(res.content);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await chatService.getTotalUnread();
      setTotalUnread(res.totalUnread);
    } catch {}
  }, []);

  useEffect(() => {
    chatWs.connect();
    fetchConversations();
    fetchUnread();
    return () => chatWs.disconnect();
  }, []);

  // Lắng nghe WS event để cập nhật real-time
  useChatListener(
    useCallback(
      (frame: WsFrame) => {
        if (frame.type === "NEW_MESSAGE") {
          const msg = frame.payload;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === msg.conversationId
                ? {
                    ...c,
                    lastMessage: msg,
                    unreadCount:
                      msg.senderId !== currentUserId
                        ? c.unreadCount + 1
                        : c.unreadCount,
                  }
                : c
            )
          );
        }
        if (frame.type === "UNREAD_COUNT") {
          setTotalUnread(frame.payload.totalUnread ?? 0);
        }
        if (frame.type === "MESSAGE_READ") {
          const { conversationId } = frame.payload;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId ? { ...c, unreadCount: 0 } : c
            )
          );
        }
      },
      [currentUserId]
    )
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Tin nhắn
        </Text>
        {totalUnread > 0 && (
          <View style={[styles.headerBadge, { backgroundColor: Colors.light.tint }]}>
            <Text style={styles.headerBadgeText}>
              {totalUnread > 99 ? "99+" : totalUnread}
            </Text>
          </View>
        )}
      </View>

      {/* List */}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ConversationItem
            item={item}
            currentUserId={currentUserId}
            colors={colors}
            onPress={() =>
              router.push({
                pathname: "/chat/[conversationId]",
                params: { conversationId: item.id.toString() },
              })
            }
          />
        )}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.separator }]} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.light.tint}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={56} color={colors.empty} />
            <Text style={[styles.emptyText, { color: colors.empty }]}>
              Chưa có cuộc trò chuyện nào
            </Text>
          </View>
        }
        contentContainerStyle={conversations.length === 0 && styles.emptyContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    flex: 1,
  },
  headerBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  headerBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  convItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
  },
  convContent: { flex: 1, gap: 4 },
  convTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  convName: { fontSize: 15, flex: 1, marginRight: 8 },
  convNameBold: { fontWeight: "700" },
  convTime: { fontSize: 12 },
  convBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  convPreview: { fontSize: 13, flex: 1, marginRight: 8 },
  convPreviewBold: { fontWeight: "600" },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  separator: { height: 1, marginLeft: 80 },
  empty: { alignItems: "center", gap: 12, paddingTop: 32 },
  emptyText: { fontSize: 15 },
  emptyContainer: { flex: 1, justifyContent: "center" },
});
