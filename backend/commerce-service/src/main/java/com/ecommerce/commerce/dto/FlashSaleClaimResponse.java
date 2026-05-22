package com.ecommerce.commerce.dto;

import java.time.OffsetDateTime;

public record FlashSaleClaimResponse(
        Long campaignId,
        Long itemId,
        String status,
        String reservationToken,
        Integer quantity,
        Long remainingStock,
        OffsetDateTime expiresAt,
        String message
) {
}
