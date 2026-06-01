package com.ecommerce.catalog.dto;

import java.math.BigDecimal;

public record CouponValidationResponse(
        boolean valid,
        BigDecimal discount,
        String message,
        CouponResponse coupon
) {
}
