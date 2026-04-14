package com.ecommerce.catalog.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CouponResponse(
        Long id,
        String code,
        String description,
        String discountType,
        BigDecimal discountValue,
        BigDecimal minOrderValue,
        BigDecimal maxDiscount,
        OffsetDateTime startAt,
        OffsetDateTime endAt,
        Integer usageLimit,
        Integer usedCount,
        boolean active,
        OffsetDateTime createdAt
) {
}
