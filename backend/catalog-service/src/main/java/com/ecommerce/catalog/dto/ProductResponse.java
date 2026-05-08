package com.ecommerce.catalog.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ProductResponse(
        Long id,
        Long subCategoryId,
        String name,
        String description,
        String thumbnail,
        BigDecimal price,
        Integer stock,
        String unit,
        BigDecimal rating,
        String brand,
        OffsetDateTime createdAt,
        UUID sellerId,
        String sellerName
) {
}
