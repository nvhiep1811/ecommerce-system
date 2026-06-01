import { apiClient } from "@/services/apiClient";
import {
  ChatConversation,
  ChatMessage,
  ChatMessageType,
  Message,
  WsFrame,
} from "@/types/chat";
import { Platform } from "react-native";

type ChatMediaAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  content?: string | null;
};

const VIDEO_EXTENSION_PATTERN = /\.(mp4|mov|webm|m4v)(\?|$)/i;

const isVideoAsset = (asset: ChatMediaAsset) =>
  Boolean(
    asset.mimeType?.startsWith("video/") ||
    asset.fileName?.match(VIDEO_EXTENSION_PATTERN) ||
    asset.uri.match(VIDEO_EXTENSION_PATTERN),
  );

const resolveChatFileUrl = (value: string | null) => {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const baseUrl = apiClient.getBaseUrl().replace(/\/api$/, "");
  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
};

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
};

const normalizeMessageType = (value: unknown): ChatMessageType => {
  if (
    value === "IMAGE" ||
    value === "VIDEO" ||
    value === "FILE" ||
    value === "TEXT"
  ) {
    return value;
  }

  return "TEXT";
};

const normalizeSenderRole = (value: unknown): "CUSTOMER" | "SELLER" =>
  value === "SELLER" ? "SELLER" : "CUSTOMER";

const mapConversation = (payload: any): ChatConversation => ({
  id: Number(payload.id),
  customer_id: payload.customerId ?? payload.customer_id,
  customer_name: payload.customerName ?? payload.customer_name ?? null,
  seller_id: payload.sellerId ?? payload.seller_id,
  seller_name: payload.sellerName ?? payload.seller_name ?? null,
  peer_name: payload.peerName ?? payload.peer_name ?? null,
  customer_avatar_url: resolveChatFileUrl(
    pickFirstString(
      payload.customerAvatarUrl,
      payload.customer_avatar_url,
      payload.customerAvatar,
      payload.customer_avatar,
      payload.customerProfileImage,
      payload.customer_profile_image,
      payload.customerImageUrl,
      payload.customer_image_url,
      payload.customer?.avatarUrl,
      payload.customer?.avatar_url,
      payload.customer?.avatar,
      payload.customer?.profileImage,
      payload.customer?.profile_image,
      payload.customer?.imageUrl,
      payload.customer?.image_url,
    ),
  ),
  seller_avatar_url: resolveChatFileUrl(
    pickFirstString(
      payload.sellerAvatarUrl,
      payload.seller_avatar_url,
      payload.sellerAvatar,
      payload.seller_avatar,
      payload.sellerProfileImage,
      payload.seller_profile_image,
      payload.sellerImageUrl,
      payload.seller_image_url,
      payload.seller?.avatarUrl,
      payload.seller?.avatar_url,
      payload.seller?.avatar,
      payload.seller?.profileImage,
      payload.seller?.profile_image,
      payload.seller?.imageUrl,
      payload.seller?.image_url,
    ),
  ),
  peer_avatar_url: resolveChatFileUrl(
    pickFirstString(
      payload.peerAvatarUrl,
      payload.peer_avatar_url,
      payload.peerAvatar,
      payload.peer_avatar,
      payload.peerProfileImage,
      payload.peer_profile_image,
      payload.peerImageUrl,
      payload.peer_image_url,
      payload.peer?.avatarUrl,
      payload.peer?.avatar_url,
      payload.peer?.avatar,
      payload.peer?.profileImage,
      payload.peer?.profile_image,
      payload.peer?.imageUrl,
      payload.peer?.image_url,
    ),
  ),
  product_id: payload.productId ?? payload.product_id ?? null,
  product_name: payload.productName ?? payload.product_name ?? null,
  product_thumbnail:
    payload.productThumbnail ?? payload.product_thumbnail ?? null,
  product_price:
    (payload.productPrice ?? payload.product_price) == null
      ? null
      : Number(payload.productPrice ?? payload.product_price),
  status: payload.status ?? "ACTIVE",
  last_message: payload.lastMessage ?? payload.last_message ?? null,
  last_message_at: payload.lastMessageAt ?? payload.last_message_at ?? null,
  unread_count: Number(payload.unreadCount ?? payload.unread_count ?? 0),
  peer_online: Boolean(payload.peerOnline ?? payload.peer_online ?? false),
  created_at: payload.createdAt ?? payload.created_at ?? null,
  updated_at: payload.updatedAt ?? payload.updated_at ?? null,
});

const mapMessage = (payload: any): ChatMessage => ({
  id: Number(payload.id),
  conversation_id: Number(payload.conversationId ?? payload.conversation_id),
  sender_id: payload.senderId ?? payload.sender_id,
  sender_role: normalizeSenderRole(payload.senderRole ?? payload.sender_role),
  message_type: normalizeMessageType(
    payload.messageType ?? payload.message_type,
  ),
  content: payload.content ?? null,
  file_url: resolveChatFileUrl(payload.fileUrl ?? payload.file_url ?? null),
  file_name: payload.fileName ?? payload.file_name ?? null,
  file_size:
    (payload.fileSize ?? payload.file_size) == null
      ? null
      : Number(payload.fileSize ?? payload.file_size),
  read: Boolean(payload.read),
  created_at: payload.createdAt ?? payload.created_at ?? null,
});

const mapLegacyMessage = (payload: any): Message => ({
  id: Number(payload.id),
  conversationId: Number(payload.conversationId ?? payload.conversation_id),
  senderId: payload.senderId ?? payload.sender_id,
  senderRole: normalizeSenderRole(payload.senderRole ?? payload.sender_role),
  messageType: normalizeMessageType(
    payload.messageType ?? payload.message_type,
  ),
  content: payload.content ?? null,
  fileUrl: resolveChatFileUrl(payload.fileUrl ?? payload.file_url ?? null),
  fileName: payload.fileName ?? payload.file_name ?? null,
  fileSize:
    (payload.fileSize ?? payload.file_size) == null
      ? null
      : Number(payload.fileSize ?? payload.file_size),
  read: Boolean(payload.read),
  createdAt:
    payload.createdAt ?? payload.created_at ?? new Date().toISOString(),
  replyToMessage: payload.replyToMessage
    ? mapLegacyMessage(payload.replyToMessage)
    : payload.reply_to_message
      ? mapLegacyMessage(payload.reply_to_message)
      : null,
});

const listConversations = async (): Promise<ChatConversation[]> => {
  const data = await apiClient.get<any>("/chat/conversations");
  return (data.items ?? []).map(mapConversation);
};

const getOrCreateConversation = async (
  productId: number,
): Promise<ChatConversation> => {
  const data = await apiClient.post<any>("/chat/conversations", {
    productId,
  });
  return mapConversation(data);
};

const startConversation = async (
  _sellerId: string,
  productId: number,
): Promise<ChatConversation> => getOrCreateConversation(productId);

const getConversation = async (
  conversationId: number,
): Promise<ChatConversation> => {
  const data = await apiClient.get<any>(
    `/chat/conversations/${conversationId}`,
  );
  return mapConversation(data);
};

const listMessages = async (conversationId: number): Promise<ChatMessage[]> => {
  const data = await apiClient.get<any>(
    `/chat/conversations/${conversationId}/messages`,
  );
  return (data.items ?? []).map(mapMessage);
};

const getMessages = async (
  conversationId: number,
): Promise<{ content: Message[] }> => ({
  content: (await listMessages(conversationId)).map(mapLegacyMessage),
});

const sendMessage = async (
  conversationId: number,
  content: string,
): Promise<ChatMessage> => {
  const data = await apiClient.post<any>(
    `/chat/conversations/${conversationId}/messages`,
    { content },
  );
  return mapMessage(data);
};

const sendMediaMessage = async (
  conversationId: number,
  asset: ChatMediaAsset,
): Promise<ChatMessage> => {
  const formData = new FormData();
  const isVideo = isVideoAsset(asset);
  const fileName =
    asset.fileName || `chat-media-${Date.now()}${isVideo ? ".mp4" : ".jpg"}`;
  const mimeType = asset.mimeType || (isVideo ? "video/mp4" : "image/jpeg");
  if (asset.content?.trim()) {
    formData.append("content", asset.content.trim());
    formData.append("caption", asset.content.trim());
  }

  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    (formData as any).append("file", blob, fileName);
  } else {
    (formData as any).append("file", {
      uri: asset.uri,
      name: fileName,
      type: mimeType,
    });
  }

  const data = await apiClient.uploadMultipart<any>(
    `/chat/conversations/${conversationId}/media`,
    formData,
    { timeoutMs: 60000 },
  );
  return mapMessage(data);
};

const markRead = async (conversationId: number): Promise<void> => {
  try {
    await apiClient.post<void>(
      `/chat/conversations/${conversationId}/read`,
      {},
    );
  } catch {
    // Backward compatible with older chat-service builds that do not expose mark-read yet.
  }
};

const markAsRead = markRead;

const deleteMessage = async (_messageId: number): Promise<void> => {
  // The current chat-service only exposes conversation-level delete.
};

const deleteConversation = async (conversationId: number): Promise<void> => {
  await apiClient.delete<void>(`/chat/conversations/${conversationId}`);
};

const getWebSocketUrl = async () => {
  const token = await apiClient.getToken();
  const baseUrl = apiClient.getBaseUrl();
  const wsBaseUrl = baseUrl.replace(/^http/i, "ws").replace(/\/api$/, "");
  return `${wsBaseUrl}/api/chat/ws?token=${encodeURIComponent(token ?? "")}`;
};

const chatService = {
  listConversations,
  getOrCreateConversation,
  startConversation,
  getConversation,
  listMessages,
  getMessages,
  sendMessage,
  sendMediaMessage,
  markRead,
  markAsRead,
  deleteConversation,
  deleteMessage,
  getWebSocketUrl,
  mapMessage,
  mapLegacyMessage,
  resolveChatFileUrl,
};

type ChatWsListener = (frame: WsFrame) => void;

const listeners = new Set<ChatWsListener>();
const subscribedConversationIds = new Set<number>();
let socket: WebSocket | null = null;

const emitFrame = (frame: WsFrame) => {
  listeners.forEach((listener) => listener(frame));
};

const sendSocketFrame = (frame: Record<string, unknown>) => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(frame));
  }
};

const normalizeSocketFrame = (payload: any): WsFrame | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload.type === "message" && payload.message) {
    return {
      type: "NEW_MESSAGE",
      payload: mapLegacyMessage(payload.message),
    };
  }

  if (payload.type === "read") {
    return {
      type: "MESSAGE_READ",
      payload: {
        conversationId: Number(payload.conversationId),
        readByUserId: payload.readerId,
      },
    };
  }

  return {
    type: String(payload.type ?? "UNKNOWN"),
    payload: payload.payload ?? payload,
  };
};

const connect = async () => {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const nextSocket = new WebSocket(await getWebSocketUrl());
  socket = nextSocket;

  nextSocket.onopen = () => {
    subscribedConversationIds.forEach((conversationId) =>
      sendSocketFrame({ type: "subscribe", conversationId }),
    );
  };
  nextSocket.onmessage = (event) => {
    try {
      const frame = normalizeSocketFrame(JSON.parse(String(event.data)));
      if (frame) {
        emitFrame(frame);
      }
    } catch {}
  };
  nextSocket.onclose = () => {
    if (socket === nextSocket) {
      socket = null;
    }
  };
  nextSocket.onerror = () => {};
};

const subscribe = (conversationId: number) => {
  subscribedConversationIds.add(conversationId);
  if (socket?.readyState === WebSocket.OPEN) {
    sendSocketFrame({ type: "subscribe", conversationId });
    return;
  }

  void connect();
};

const chatWs = {
  connect: () => {
    void connect();
  },
  disconnect: () => {
    socket?.close();
    socket = null;
  },
  addListener: (listener: ChatWsListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  markRead: (conversationId: number) => {
    subscribe(conversationId);
    void markRead(conversationId);
    sendSocketFrame({ type: "subscribe", conversationId });
  },
  sendTyping: (conversationId: number, isTyping: boolean) => {
    subscribe(conversationId);
    sendSocketFrame({
      type: "TYPING",
      payload: { conversationId, isTyping },
    });
  },
  send: (type: string, payload: Record<string, any> = {}) => {
    const conversationId = Number(payload.conversationId);
    if (conversationId > 0) {
      subscribe(conversationId);
    }

    if (
      type === "SEND_MESSAGE" &&
      conversationId > 0 &&
      normalizeMessageType(payload.messageType) === "TEXT" &&
      typeof payload.content === "string" &&
      payload.content.trim()
    ) {
      void sendMessage(conversationId, payload.content).then((message) =>
        emitFrame({ type: "NEW_MESSAGE", payload: mapLegacyMessage(message) }),
      );
      return;
    }

    sendSocketFrame({ type, payload });
  },
};

export { chatService, chatWs };
