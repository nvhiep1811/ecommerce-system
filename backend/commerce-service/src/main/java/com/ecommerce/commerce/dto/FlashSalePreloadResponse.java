package com.ecommerce.commerce.dto;

public record FlashSalePreloadResponse(
        Long campaignId,
        Long itemId,
        Integer stock,
        Integer perUserLimit,
        String status,
        String message
) {
}