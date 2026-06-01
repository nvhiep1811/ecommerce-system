import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { chatService } from "@/services/chatService";
import { ChatConversation } from "@/types/chat";
import { formatCurrencyVnd } from "@/utils/format";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

const formatTime = (value: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
};

const getInitials = (value: string | null | undefined) => {
  const words = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) {
    return "?";
  }

  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
};

const getConversationTitle = (conversation: ChatConversation) =>
  conversation.peer_name ||
  conversation.seller_name ||
  conversation.customer_name ||
  "Người dùng";

const getPeerId = (
  conversation: ChatConversation,
  userId: string | null | undefined,
) => {
  if (!userId) {
    return null;
  }

  return conversation.customer_id === userId
    ? conversation.seller_id
    : conversation.customer_id;
};

const getPeerAvatarUri = (
  conversation: ChatConversation,
  userId: string | null | undefined,
) =>
  conversation.peer_avatar_url ??
  (userId
    ? conversation.customer_id === userId
      ? conversation.seller_avatar_url
      : conversation.customer_avatar_url
    : null) ??
  null;

const getConversationTime = (conversation: ChatConversation) =>
  new Date(
    conversation.last_message_at ?? conversation.updated_at ?? conversation.created_at ?? 0,
  ).getTime();

const firstValue = (...values: Array<string | null | undefined>) =>
  values.find((value) => Boolean(value)) ?? null;

const mergeConversationForList = (
  current: ChatConversation,
  next: ChatConversation,
) => {
  const latest =
    getConversationTime(next) > getConversationTime(current) ? next : current;
  const older = latest.id === next.id ? current : next;

  return {
    ...latest,
    unread_count: current.unread_count + next.unread_count,
    peer_online: current.peer_online || next.peer_online,
    peer_avatar_url: firstValue(
      latest.peer_avatar_url,
      older.peer_avatar_url,
    ),
    seller_avatar_url: firstValue(
      latest.seller_avatar_url,
      older.seller_avatar_url,
    ),
    customer_avatar_url: firstValue(
      latest.customer_avatar_url,
      older.customer_avatar_url,
    ),
  };
};

const groupConversationsByPeer = (
  items: ChatConversation[],
  userId: string | null | undefined,
) => {
  const grouped = new Map<string, ChatConversation>();

  items.forEach((item) => {
    const peerKey = getPeerId(item, userId) || `conversation:${item.id}`;
    const existing = grouped.get(peerKey);
    grouped.set(
      peerKey,
      existing ? mergeConversationForList(existing, item) : item,
    );
  });

  return Array.from(grouped.values()).sort(
    (left, right) => getConversationTime(right) - getConversationTime(left),
  );
};

export default function ChatListScreen() {
  const { user } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const conversationsRef = useRef<ChatConversation[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const conversationIdsKey = useMemo(
    () => conversations.map((item) => item.id).join(","),
    [conversations],
  );

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const loadConversations = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setConversations(await chatService.listConversations());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách chat",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadConversations();
    }, [loadConversations]),
  );

  useEffect(() => {
    if (!user?.id || !conversationIdsKey) {
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
        conversationsRef.current.forEach((conversation) => {
          socket.send(
            JSON.stringify({
              type: "subscribe",
              conversationId: conversation.id,
            }),
          );
        });
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "presence" && payload.userId) {
            setConversations((current) =>
              current.map((item) => {
                const peerId =
                  item.customer_id === user.id ? item.seller_id : item.customer_id;
                return peerId === payload.userId
                  ? { ...item, peer_online: Boolean(payload.online) }
                  : item;
              }),
            );
            return;
          }

          if (payload.type === "read" && payload.conversationId) {
            setConversations((current) =>
              current.map((item) =>
                item.id === Number(payload.conversationId) &&
                payload.readerId === user.id
                  ? { ...item, unread_count: 0 }
                  : item,
              ),
            );
            return;
          }

          if (payload.type !== "message" || !payload.message) {
            return;
          }

          const message = chatService.mapMessage(payload.message);
          setConversations((current) =>
            current
              .map((item) =>
                item.id === message.conversation_id
                  ? {
                      ...item,
                      last_message:
                        message.content ||
                        (message.message_type === "IMAGE"
                          ? "Đã gửi một ảnh"
                          : "Đã gửi một video"),
                      last_message_at: message.created_at,
                      unread_count:
                        message.sender_id === user.id
                          ? item.unread_count
                          : item.unread_count + 1,
                    }
                  : item,
              )
              .sort((left, right) => {
                const leftTime = new Date(left.last_message_at ?? left.updated_at ?? 0).getTime();
                const rightTime = new Date(right.last_message_at ?? right.updated_at ?? 0).getTime();
                return rightTime - leftTime;
              }),
          );
        } catch {}
      };
    };

    void connect();
    return () => {
      closedByScreen = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [conversationIdsKey, user?.id]);

  const displayConversations = useMemo(
    () => groupConversationsByPeer(conversations, user?.id),
    [conversations, user?.id],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredConversations = displayConversations.filter((item) => {
    if (!normalizedQuery) {
      return true;
    }
    return [item.peer_name, item.customer_name, item.seller_name, item.product_name, item.last_message]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedQuery));
  });

  const handleRemoveConversationGroup = useCallback(
    async (conversation: ChatConversation) => {
      const previousConversations = conversationsRef.current;
      const peerKey = getPeerId(conversation, user?.id);
      const idsToRemove = peerKey
        ? previousConversations
            .filter((item) => getPeerId(item, user?.id) === peerKey)
            .map((item) => item.id)
        : [conversation.id];

      if (idsToRemove.length === 0) {
        return;
      }

      setConversations((current) =>
        current.filter((item) => !idsToRemove.includes(item.id)),
      );

      try {
        await Promise.all(
          idsToRemove.map((conversationId) =>
            chatService.deleteConversation(conversationId),
          ),
        );
      } catch (deleteError) {
        setConversations(previousConversations);
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Không thể xóa cuộc trò chuyện",
        );
      }
    },
    [user?.id],
  );

  const renderRightActions = useCallback(
    (conversation: ChatConversation) => (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleRemoveConversationGroup(conversation)}
      >
        <Ionicons name="trash-outline" size={22} color="#fff" />
        <Text style={styles.deleteActionText}>Xóa</Text>
      </TouchableOpacity>
    ),
    [handleRemoveConversationGroup],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace("/(tabs)/profile");
          }}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.light.tint} />
        </TouchableOpacity>
        <Text style={styles.title}>Tin nhắn</Text>
        <View style={styles.headerButton} />
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#b8b8b8" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm kiếm"
          placeholderTextColor="#a3a3a3"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.light.tint} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadConversations()}
          >
            <Text style={styles.retryText}>Thu lai</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filteredConversations}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadConversations(true)}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Chưa có cuộc trò chuyện nào</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={() => renderRightActions(item)}
              overshootRight={false}
            >
              <TouchableOpacity
              style={styles.chatItem}
              onPress={() =>
                router.navigate({
                  pathname: "/chat/[id]" as any,
                  params: { id: String(item.id) },
                })
              }
            >
              <View style={styles.avatarWrap}>
                {getPeerAvatarUri(item, user?.id) ? (
                  <Image
                    source={{ uri: getPeerAvatarUri(item, user?.id)! }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {getInitials(getConversationTitle(item))}
                    </Text>
                  </View>
                )}
                {item.peer_online ? <View style={styles.onlineDot} /> : null}
              </View>
              <View style={styles.chatContent}>
                <View style={styles.chatTitleRow}>
                  <Text style={styles.sellerName} numberOfLines={1}>
                    {getConversationTitle(item)}
                  </Text>
                  <Text style={styles.timeText}>
                    {formatTime(item.last_message_at ?? item.updated_at)}
                  </Text>
                </View>
                {item.product_name ? (
                  <Text style={styles.productLine} numberOfLines={1}>
                    {item.product_name}
                    {item.product_price != null
                      ? ` - ${formatCurrencyVnd(item.product_price)}`
                      : ""}
                  </Text>
                ) : null}
                <View style={styles.lastRow}>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.last_message || "Đã chia sẻ một sản phẩm."}
                </Text>
                  {item.unread_count > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {item.unread_count > 9 ? "9+" : item.unread_count}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              </TouchableOpacity>
            </Swipeable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f1f1",
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    marginHorizontal: 14,
    marginVertical: 12,
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: "#f3f3f3",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  list: {
    flex: 1,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  avatarWrap: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#00a8b5",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f2f2f2",
  },
  onlineDot: {
    position: "absolute",
    right: -1,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#16a34a",
    borderWidth: 2,
    borderColor: "#fff",
  },
  chatContent: {
    flex: 1,
    minWidth: 0,
  },
  chatTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sellerName: {
    flex: 1,
    marginRight: 8,
    fontSize: 16,
    fontWeight: "700",
    color: "#202020",
  },
  timeText: {
    fontSize: 12,
    color: "#999",
  },
  productLine: {
    marginBottom: 3,
    fontSize: 12,
    color: "#777",
  },
  lastRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lastMessage: {
    flex: 1,
    fontSize: 13,
    color: "#777",
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.tint,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
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
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
  },
  deleteAction: {
    width: 88,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
  },
  deleteActionText: {
    marginTop: 4,
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
