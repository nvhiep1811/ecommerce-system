export type ChatMessageType = "TEXT" | "IMAGE" | "VIDEO" | "FILE";

export type ChatConversation = {
  id: number;
  customer_id: string;
  customer_name: string | null;
  seller_id: string;
  seller_name: string | null;
  peer_name: string | null;
  customer_avatar_url: string | null;
  seller_avatar_url: string | null;
  peer_avatar_url: string | null;
  product_id: number | null;
  product_name: string | null;
  product_thumbnail: string | null;
  product_price: number | null;
  status: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  peer_online: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ChatMessage = {
  id: number;
  conversation_id: number;
  sender_id: string;
  sender_role: "CUSTOMER" | "SELLER";
  message_type: ChatMessageType;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  read: boolean;
  created_at: string | null;
};

export type Message = {
  id: number;
  conversationId: number;
  senderId: string;
  senderRole: "CUSTOMER" | "SELLER";
  messageType: ChatMessageType;
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  read: boolean;
  createdAt: string;
  replyToMessage?: Message | null;
};

export type WsFrame = {
  type: string;
  payload?: any;
};
