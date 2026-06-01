package com.ecommerce.commerce.dto;

import java.util.List;

public record PaymentMethodResponse(
        String code,
        String name,
        String description,
        boolean enabled,
        String type,
        int priority,
        List<String> features
) {
}
