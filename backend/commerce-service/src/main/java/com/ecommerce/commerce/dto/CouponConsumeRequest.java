package com.ecommerce.commerce.dto;

import java.util.UUID;

public record CouponConsumeRequest(
        Long couponId,
        UUID userId,
        Long orderId
) {
}
