package com.ecommerce.catalog.dto;

public record InventoryUpsertRequest(
        Long productId,
        Integer stock
) {
}
