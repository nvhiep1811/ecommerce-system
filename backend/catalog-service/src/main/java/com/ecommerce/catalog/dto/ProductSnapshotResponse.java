package com.ecommerce.catalog.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductSnapshotResponse(
        Long productId,
        String name,
        String sku,
        String thumbnailUrl,
        BigDecimal price,
        UUID sellerId,
        boolean active
) {
}
