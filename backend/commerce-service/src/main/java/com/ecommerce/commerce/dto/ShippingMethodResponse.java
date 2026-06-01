package com.ecommerce.commerce.dto;

import java.math.BigDecimal;

public record ShippingMethodResponse(
        Long id,
        String name,
        String description,
        Integer estimatedMinDays,
        Integer estimatedMaxDays,
        BigDecimal fee,
        boolean active
) {
}
