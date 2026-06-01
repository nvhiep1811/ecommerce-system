package com.ecommerce.commerce.dto;

public record InventoryUpsertRequest(
        Long productId,
        Integer stock
) {
}
