package com.ecommerce.commerce.dto;

import java.math.BigDecimal;

public record AdminFlashSaleItemResponse(
        Long id,
        Long campaignId,
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
