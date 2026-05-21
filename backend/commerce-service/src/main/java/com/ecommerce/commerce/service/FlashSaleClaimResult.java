package com.ecommerce.commerce.service;

import java.time.OffsetDateTime;

public record FlashSaleClaimResult(
        String status,
        String reservationToken,
        Integer quantity,
        Long remainingStock,
        OffsetDateTime expiresAt
) {

    public boolean reserved() {
        return "RESERVED".equals(status) || "DUPLICATE".equals(status);
    }
}
