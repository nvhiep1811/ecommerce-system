package com.ecommerce.commerce.service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record FlashSaleCheckoutReservation(
        Long campaignId,
        Long itemId,
        Long productId,
        Long variantId,
        String reservationToken,
        Integer quantity,
        BigDecimal salePrice,
        OffsetDateTime expiresAt
) {
}
