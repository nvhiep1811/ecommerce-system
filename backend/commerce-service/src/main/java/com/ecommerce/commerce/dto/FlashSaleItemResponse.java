package com.ecommerce.commerce.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record FlashSaleItemResponse(
        Long campaignId,
        String campaignName,
        OffsetDateTime startsAt,
        OffsetDateTime endsAt,
        Long itemId,
        Long productId,
        Long variantId,
        String productName,
        String productThumbnail,
        BigDecimal originalPrice,
        BigDecimal salePrice,
        Integer stockLimit,
        Integer reservedCount,
        Integer soldCount,
        Long remainingStock,
        Integer perUserLimit,
        String status
) {
}
