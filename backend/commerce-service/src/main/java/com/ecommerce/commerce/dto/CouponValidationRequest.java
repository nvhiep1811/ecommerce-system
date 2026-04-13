package com.ecommerce.commerce.dto;

import java.math.BigDecimal;

public record CouponValidationRequest(
        String code,
        BigDecimal orderValue
) {
}
