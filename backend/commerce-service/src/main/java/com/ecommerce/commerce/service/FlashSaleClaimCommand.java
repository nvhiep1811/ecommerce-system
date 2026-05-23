package com.ecommerce.commerce.service;

import java.util.UUID;

public record FlashSaleClaimCommand(
        Long campaignId,
        Long itemId,
        UUID userId,
        String requestId,
        Integer quantity
) {
}
