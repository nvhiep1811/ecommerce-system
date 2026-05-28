package com.ecommerce.catalog.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductSnapshotResponse(
        Long productId,
        Long variantId,
        String name,
        String variantName,
        String sku,
        String thumbnailUrl,
        BigDecimal price,
        UUID sellerId,
        boolean active
) {
    public ProductSnapshotResponse(
            Long productId,
            String name,
            String sku,
            String thumbnailUrl,
            BigDecimal price,
            UUID sellerId,
            boolean active
    ) {
        this(productId, null, name, null, sku, thumbnailUrl, price, sellerId, active);
    }
}
