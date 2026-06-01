package com.ecommerce.commerce.dto;

import java.math.BigDecimal;

public record OrderItemResponse(
        Long id,
        Long productId,
        Long variantId,
        String variantName,
        Integer quantity,
        BigDecimal price,
        OrderItemProductResponse products
) {
}
