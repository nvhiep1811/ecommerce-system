package com.ecommerce.commerce.dto;

import java.math.BigDecimal;

public record CouponValidationResponse(
        boolean valid,
        BigDecimal discount,
        String message,
        CouponPayload coupon
) {
}
