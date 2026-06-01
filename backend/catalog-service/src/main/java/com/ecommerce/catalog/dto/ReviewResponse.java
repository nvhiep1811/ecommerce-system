package com.ecommerce.catalog.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record ReviewResponse(
        Long id,
        UUID userId,
        Long productId,
        Long orderItemId,
        Integer rating,
        String comment,
        List<String> imageUrls,
        boolean verifiedPurchase,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
