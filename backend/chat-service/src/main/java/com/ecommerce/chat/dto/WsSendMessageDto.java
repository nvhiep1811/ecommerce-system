package com.ecommerce.chat.dto;

import com.ecommerce.chat.enums.MessageType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

/**
 * Payload khi client gửi tin nhắn qua WebSocket.
 *
 * Ví dụ JSON:
 * {
 *   "type": "SEND_MESSAGE",
 *   "payload": {
 *     "conversationId": 1,
 *     "content": "Sản phẩm còn hàng không?",
 *     "messageType": "TEXT"
 *   }
 * }
 */
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class WsSendMessageDto {

    @NotNull(message = "conversationId không được null")
    private Long conversationId;

    @Size(max = 5000, message = "Tin nhắn tối đa 5000 ký tự")
    private String content;

    private MessageType messageType;

    /** Điền sau khi upload file thành công qua REST /api/chat/upload */
    private String fileUrl;
    private String fileName;
    private Long   fileSize;
    private Long replyToMessageId;
}
