package com.ecommerce.chat.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.util.Map;

/**
 * Frame chuẩn bọc mọi message qua WebSocket thuần.
 *
 * CLIENT → SERVER
 *   SEND_MESSAGE  – payload: WsSendMessageDto
 *   MARK_READ     – payload: WsMarkReadDto
 *   TYPING        – payload: WsTypingDto
 *
 * SERVER → CLIENT
 *   CONNECTED         – xác nhận kết nối thành công
 *   NEW_MESSAGE       – payload: MessageResponseDto
 *   MESSAGE_DELETED   – payload: { messageId, conversationId }
 *   MESSAGE_READ      – payload: { conversationId, readByUserId }
 *   TYPING_INDICATOR  – payload: { conversationId, userId, isTyping }
 *   UNREAD_COUNT      – payload: UnreadCountResponseDto
 *   ERROR             – payload: { message }
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WsFrame {

    private String type;
    private Object payload;

    public static WsFrame of(String type, Object payload) {
        return new WsFrame(type, payload);
    }

    public static WsFrame error(String message) {
        return WsFrame.of("ERROR", Map.of("message", message));
    }
}
