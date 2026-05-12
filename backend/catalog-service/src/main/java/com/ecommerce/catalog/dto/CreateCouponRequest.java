package com.ecommerce.catalog.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CreateCouponRequest(
        @NotBlank(message = "Coupon code is required")
        @Size(min = 1, max = 60, message = "Code must be between 1 and 60 characters")
        String code,

        String description,

        @NotBlank(message = "Discount type is required")
        @Pattern(regexp = "^(percent|fixed)$", message = "Discount type must be 'percent' or 'fixed'")
        String discountType,

        @NotNull(message = "Discount value is required")
        @DecimalMin(value = "0", message = "Discount value must be non-negative")
        @DecimalMax(value = "999999.99", message = "Discount value is too large")
        BigDecimal discountValue,

        @NotNull(message = "Minimum order value is required")
        @DecimalMin(value = "0", message = "Minimum order value must be non-negative")
        BigDecimal minOrderValue,

        @DecimalMin(value = "0", message = "Maximum discount must be non-negative")
        BigDecimal maxDiscount,

        OffsetDateTime startAt,

        OffsetDateTime endAt,

        @Min(value = 0, message = "Usage limit must be non-negative")
        Integer usageLimit,

        @NotNull(message = "Active status is required")
        Boolean active
) {}

