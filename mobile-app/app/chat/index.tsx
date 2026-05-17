import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Conversation = {
  id: string;

  sellerName: string;
  sellerAvatar: string;

  lastMessage: string;

  lastMessageType: "TEXT" | "IMAGE" | "FILE";

  lastMessageTime: string;

  unreadCount: number;

  isOnline: boolean;

  isVerified: boolean;
};

const conversations: Conversation[] = [
  {
    id: "1",
    sellerName: "MegaMall Official",
    sellerAvatar:
      "https://i.pravatar.cc/150?img=12",

    lastMessage: "Shop đã xác nhận đơn hàng của bạn",

    lastMessageType: "TEXT",

    lastMessageTime: "09:30",

    unreadCount: 3,

    isOnline: true,

    isVerified: true,
  },
  {
    id: "2",
    sellerName: "Gaming Gear Store",
    sellerAvatar:
      "https://i.pravatar.cc/150?img=15",

    lastMessage: "Đã gửi hình ảnh",

    lastMessageType: "IMAGE",

    lastMessageTime: "Hôm qua",

    unreadCount: 0,

    isOnline: false,

    isVerified: false,
  },
];

export default function ChatListScreen() {
  const renderLastMessage = (item: Conversation) => {
    switch (item.lastMessageType) {
      case "IMAGE":
        return "📷 Hình ảnh";

      case "FILE":
        return "📎 Tệp đính kèm";

      default:
        return item.lastMessage;
    }
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

              router.replace("/(tabs)/profile");
            }}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color="white"
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Trò chuyện</Text>

        <View style={styles.headerSide}>
          <TouchableOpacity>
            <Ionicons
              name="search-outline"
              size={22}
              color="white"
            />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            activeOpacity={0.7}
            onPress={() =>
              router.navigate({
                pathname: "/chat/[id]" as any,
                params: {
                  id: item.id,
                },
              })
            }
          >
            {/* Avatar */}
            <View style={styles.avatarWrapper}>
              <Image
                source={{
                  uri: item.sellerAvatar,
                }}
                style={styles.avatar}
              />

              {item.isOnline && (
                <View style={styles.onlineDot} />
              )}
            </View>

            {/* Content */}
            <View style={styles.chatContent}>
              <View style={styles.topRow}>
                <View style={styles.nameRow}>
                  <Text
                    style={styles.sellerName}
                    numberOfLines={1}
                  >
                    {item.sellerName}
                  </Text>

                  {item.isVerified && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#1DA1F2"
                      style={styles.verifiedIcon}
                    />
                  )}
                </View>

                <Text style={styles.timeText}>
                  {item.lastMessageTime}
                </Text>
              </View>

              <View style={styles.bottomRow}>
                <Text
                  style={[
                    styles.lastMessage,
                    item.unreadCount > 0 &&
                      styles.unreadMessage,
                  ]}
                  numberOfLines={1}
                >
                  {renderLastMessage(item)}
                </Text>

                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {item.unreadCount > 99
                        ? "99+"
                        : item.unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f6f6",
  },

  header: {
    height: 56,
    backgroundColor: Colors.light.tint,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingHorizontal: 12,
  },

  headerSide: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  backButton: {
    width: 40,
    height: 40,

    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    flex: 1,

    textAlign: "center",

    fontSize: 18,
    fontWeight: "700",

    color: "#fff",
  },

  listContent: {
    paddingVertical: 6,
  },

  chatItem: {
    flexDirection: "row",

    backgroundColor: "#fff",

    marginHorizontal: 10,
    marginVertical: 4,

    borderRadius: 14,

    paddingHorizontal: 12,
    paddingVertical: 12,

    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  avatarWrapper: {
    position: "relative",
    marginRight: 12,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },

  onlineDot: {
    position: "absolute",

    right: 2,
    bottom: 2,

    width: 14,
    height: 14,

    borderRadius: 7,

    backgroundColor: "#22c55e",

    borderWidth: 2,
    borderColor: "#fff",
  },

  chatContent: {
    flex: 1,
    minWidth: 0,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    marginBottom: 6,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",

    flex: 1,

    marginRight: 10,
  },

  sellerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },

  verifiedIcon: {
    marginLeft: 4,
  },

  timeText: {
    fontSize: 12,
    color: "#999",
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  lastMessage: {
    flex: 1,

    fontSize: 13,
    color: "#666",

    marginRight: 8,
  },

  unreadMessage: {
    color: "#111",
    fontWeight: "600",
  },

  unreadBadge: {
    minWidth: 20,
    height: 20,

    borderRadius: 10,

    backgroundColor: "#ff424f",

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 6,
  },

  unreadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});