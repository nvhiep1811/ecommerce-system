package com.ecommerce.commerce.dto;

import java.util.List;

public record ProductSnapshotRequest(
        List<Long> productIds,
        List<ProductSnapshotLineRequest> items
) {
    public ProductSnapshotRequest(List<Long> productIds) {
        this(productIds, null);
    }

    public record ProductSnapshotLineRequest(
            Long productId,
            Long variantId
    ) {
    }
}
