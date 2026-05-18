// services/chatService.ts

import { apiClient } from "./apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type {
  Conversation,
  Message,
  PageResponse,
  UnreadCount,
  WsFrame,
} from "@/types/chat";

// ─── REST API ─────────────────────────────────────────────────────────────────

export const chatService = {
  /** Tạo hoặc lấy conversation với seller */
  startConversation: (sellerId: string, productId?: number) =>
    apiClient.post<Conversation>("/chat/conversations", { sellerId, productId }),

  /** Danh sách conversation phân trang */
  getConversations: (role: "CUSTOMER" | "SELLER", page = 0, size = 20) =>
    apiClient.get<PageResponse<Conversation>>(
      `/chat/conversations?role=${role}&page=${page}&size=${size}`
    ),

  /** Lịch sử tin nhắn phân trang */
  getMessages: (conversationId: number, page = 0, size = 30) =>
    apiClient.get<PageResponse<Message>>(
      `/chat/conversations/${conversationId}/messages?page=${page}&size=${size}`
    ),

  /** Đánh dấu đã đọc */
  markAsRead: (conversationId: number) =>
    apiClient.put<void>(`/chat/conversations/${conversationId}/read`),

  /** Xóa tin nhắn */
  deleteMessage: (messageId: number) =>
    apiClient.delete<void>(`/chat/messages/${messageId}`),

  /** Tổng tin chưa đọc */
  getTotalUnread: () => apiClient.get<UnreadCount>("/chat/unread"),

  /** Upload file/ảnh */
  uploadFile: (file: { uri: string; name: string; type: string }) => {
    const formData = new FormData();
    formData.append("file", file as any);
    return apiClient.uploadMultipart<{
      fileUrl: string;
      fileName: string;
      fileSize: number;
      contentType: string;
    }>("/chat/upload", formData);
  },
};

// ─── WebSocket ────────────────────────────────────────────────────────────────

const getWsBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_WS_BASE_URL;
  if (envUrl) return envUrl;

  const expoHost = (() => {
    const h =
      (Constants.expoConfig as any)?.hostUri ||
      (Constants as any)?.expoGoConfig?.debuggerHost;
    return h ? h.split(":")[0] : null;
  })();

  if (expoHost) return `ws://${expoHost}:8080`;
  if (Platform.OS === "android") return "ws://10.0.2.2:8080";
  return "ws://localhost:8080";
};

type WsListener = (frame: WsFrame) => void;

class ChatWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<WsListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isIntentionallyClosed = false;

  async connect() {
    this.isIntentionallyClosed = false;
    const token = await AsyncStorage.getItem("auth_token");
    if (!token) return;

    const url = `${getWsBaseUrl()}/ws/chat?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      console.log("[WS] Connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const frame: WsFrame = JSON.parse(event.data);
        this.listeners.forEach((l) => l(frame));
      } catch (e) {
        console.error("[WS] Parse error", e);
      }
    };

    this.ws.onclose = () => {
      console.log("[WS] Closed");
      if (!this.isIntentionallyClosed) this.scheduleReconnect();
    };

    this.ws.onerror = (e) => {
      console.error("[WS] Error", e);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(type: string, payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  sendMessage(conversationId: number, content: string) {
    this.send("SEND_MESSAGE", { conversationId, content, messageType: "TEXT" });
  }

  sendImageMessage(
    conversationId: number,
    fileUrl: string,
    fileName: string,
    fileSize: number
  ) {
    this.send("SEND_MESSAGE", {
      conversationId,
      messageType: "IMAGE",
      fileUrl,
      fileName,
      fileSize,
    });
  }

  markRead(conversationId: number) {
    this.send("MARK_READ", { conversationId });
  }

  sendTyping(conversationId: number, isTyping: boolean) {
    this.send("TYPING", { conversationId, isTyping });
  }

  addListener(listener: WsListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const chatWs = new ChatWebSocketClient();
