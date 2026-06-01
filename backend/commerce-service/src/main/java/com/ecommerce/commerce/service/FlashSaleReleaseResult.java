package com.ecommerce.commerce.service;

import java.time.OffsetDateTime;
import java.util.UUID;

public record FlashSaleReleaseResult(
        String status,
        String reservationToken,
        UUID userId,
        String requestId,
        Integer quantity,
        OffsetDateTime expiresAt
) {

    public boolean released() {
        return "RELEASED".equals(status);
    }
}
