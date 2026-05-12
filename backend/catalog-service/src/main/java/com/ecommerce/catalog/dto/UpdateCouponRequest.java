package com.ecommerce.catalog.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record UpdateCouponRequest(
        String description,

        @Pattern(regexp = "^(percent|fixed)$", message = "Discount type must be 'percent' or 'fixed'")
        String discountType,

        @DecimalMin(value = "0", message = "Discount value must be non-negative")
        @DecimalMax(value = "999999.99", message = "Discount value is too large")
        BigDecimal discountValue,

        @DecimalMin(value = "0", message = "Minimum order value must be non-negative")
        BigDecimal minOrderValue,

        @DecimalMin(value = "0", message = "Maximum discount must be non-negative")
        BigDecimal maxDiscount,

        OffsetDateTime startAt,

        OffsetDateTime endAt,

        @Min(value = 0, message = "Usage limit must be non-negative")
        Integer usageLimit,

        Boolean active
) {}

