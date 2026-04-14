package com.ecommerce.commerce.dto;

import java.math.BigDecimal;

public record OrderItemProductResponse(
        Long id,
        String name,
        String thumbnail,
        BigDecimal price,
        String description,
        Integer stock
) {
}
