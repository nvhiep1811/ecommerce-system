// types/chat.ts

export type MessageType = "TEXT" | "IMAGE" | "FILE";
export type SenderRole = "CUSTOMER" | "SELLER";
export type ConversationStatus = "ACTIVE" | "CLOSED" | "BLOCKED";

export interface Message {
  id: number;
  conversationId: number;
  senderId: string;        // UUID
  senderRole: SenderRole;
  content: string | null;
  messageType: MessageType;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  read: boolean;
  createdAt: string;       // ISO-8601
}

export interface Conversation {
  id: number;
  customerId: string;      // UUID
  sellerId: string;        // UUID
  productId: number | null;
  status: ConversationStatus;
  unreadCount: number;
  lastMessage: Message | null;
  updatedAt: string;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// WebSocket frame types
export type WsEventType =
  | "CONNECTED"
  | "NEW_MESSAGE"
  | "MESSAGE_DELETED"
  | "MESSAGE_READ"
  | "TYPING_INDICATOR"
  | "UNREAD_COUNT"
  | "ERROR";

export interface WsFrame {
  type: WsEventType | string;
  payload: any;
}

export interface UnreadCount {
  totalUnread: number;
  conversationId?: number;
}
