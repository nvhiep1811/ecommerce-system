import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ChatSeller = {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
};

const sellers: ChatSeller[] = [
  {
    id: "megamall-seller",
    name: "MegaMall Seller",
    lastMessage: "Xin chào, shop có thể hỗ trợ gì cho bạn?",
    time: "09:30",
  },
];

export default function ChatListScreen() {
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
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Trò chuyện</Text>
        <View style={styles.headerSide} />
      </View>

      <FlatList
        style={styles.list}
        data={sellers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() =>
              router.navigate({
                pathname: "/chat/[id]" as any,
                params: {
                  id: item.id,
                  sellerName: item.name,
                },
              })
            }
          >
            <View style={styles.avatar}>
              <Ionicons name="storefront-outline" size={24} color="#fff" />
            </View>
            <View style={styles.chatContent}>
              <View style={styles.chatTitleRow}>
                <Text style={styles.sellerName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.timeText}>{item.time}</Text>
              </View>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage}
              </Text>
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
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  list: {
    flex: 1,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
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
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginRight: 8,
  },
  timeText: {
    fontSize: 12,
    color: "#999",
  },
  lastMessage: {
    fontSize: 13,
    color: "#666",
  },
});
