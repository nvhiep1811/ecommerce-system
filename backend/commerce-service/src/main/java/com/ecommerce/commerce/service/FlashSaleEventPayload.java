package com.ecommerce.commerce.service;

import java.time.OffsetDateTime;
import java.util.UUID;

public record FlashSaleEventPayload(
        String eventId,
        String eventType,
        OffsetDateTime occurredAt,
        Long campaignId,
        Long itemId,
        UUID userId,
        String requestId,
        String reservationToken,
        Integer quantity,
        Long remainingStock,
        OffsetDateTime expiresAt
) {
}
