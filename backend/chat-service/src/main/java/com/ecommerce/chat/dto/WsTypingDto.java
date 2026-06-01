package com.ecommerce.chat.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

/**
 * Payload khi client gửi trạng thái "đang gõ".
 *
 * Ví dụ JSON:
 * {
 *   "type": "TYPING",
 *   "payload": { "conversationId": 1, "isTyping": true }
 * }
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WsTypingDto {

    @NotNull(message = "conversationId không được null")
    private Long conversationId;

    /** true = đang gõ, false = dừng gõ */
    private boolean isTyping;
}
