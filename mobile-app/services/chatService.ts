import { apiClient } from "@/services/apiClient";
import { ChatConversation, ChatMessage } from "@/types/chat";
import { Platform } from "react-native";

type ChatMediaAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
};

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

const mapConversation = (payload: any): ChatConversation => ({
  id: Number(payload.id),
  customer_id: payload.customerId ?? payload.customer_id,
  customer_name: payload.customerName ?? payload.customer_name ?? null,
  seller_id: payload.sellerId ?? payload.seller_id,
  seller_name: payload.sellerName ?? payload.seller_name ?? null,
  peer_name: payload.peerName ?? payload.peer_name ?? null,
  product_id: payload.productId ?? payload.product_id ?? null,
  product_name: payload.productName ?? payload.product_name ?? null,
  product_thumbnail: payload.productThumbnail ?? payload.product_thumbnail ?? null,
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
  sender_role: payload.senderRole ?? payload.sender_role ?? "CUSTOMER",
  message_type: payload.messageType ?? payload.message_type ?? "TEXT",
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
  const fileName =
    asset.fileName ||
    `chat-media-${Date.now()}${asset.mimeType?.startsWith("video/") ? ".mp4" : ".jpg"}`;
  const mimeType =
    asset.mimeType || (fileName.toLowerCase().endsWith(".mp4") ? "video/mp4" : "image/jpeg");

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
    await apiClient.post<void>(`/chat/conversations/${conversationId}/read`, {});
  } catch {
    // Backward compatible with older chat-service builds that do not expose mark-read yet.
  }
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
  getConversation,
  listMessages,
  sendMessage,
  sendMediaMessage,
  markRead,
  deleteConversation,
  getWebSocketUrl,
  mapMessage,
  resolveChatFileUrl,
};

export { chatService };
