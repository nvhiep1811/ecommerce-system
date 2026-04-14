package com.ecommerce.catalog.dto;

import java.util.UUID;

public record CouponConsumeRequest(
        Long couponId,
        UUID userId,
        Long orderId
) {
}
