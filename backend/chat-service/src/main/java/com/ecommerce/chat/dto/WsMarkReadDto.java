package com.ecommerce.chat.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

/**
 * Payload khi client đánh dấu đã đọc toàn bộ tin nhắn trong conversation.
 *
 * Ví dụ JSON:
 * {
 *   "type": "MARK_READ",
 *   "payload": { "conversationId": 1 }
 * }
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WsMarkReadDto {

    @NotNull(message = "conversationId không được null")
    private Long conversationId;
}
