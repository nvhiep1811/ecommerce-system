package com.ecommerce.chat.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ChatConversationResponse(
        Long id,
        UUID customerId,
        String customerName,
        String customerAvatarUrl,
        UUID sellerId,
        String sellerName,
        String sellerAvatarUrl,
        String peerName,
        String peerAvatarUrl,
        Long productId,
        String productName,
        String productThumbnail,
        BigDecimal productPrice,
        String status,
        String lastMessage,
        OffsetDateTime lastMessageAt,
        int unreadCount,
        boolean peerOnline,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
