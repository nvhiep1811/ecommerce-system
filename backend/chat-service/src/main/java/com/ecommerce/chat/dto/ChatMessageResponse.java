package com.ecommerce.chat.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ChatMessageResponse(
        Long id,
        Long conversationId,
        UUID senderId,
        String senderRole,
        String messageType,
        String content,
        String fileUrl,
        String fileName,
        Long fileSize,
        boolean read,
        OffsetDateTime createdAt
) {
}
