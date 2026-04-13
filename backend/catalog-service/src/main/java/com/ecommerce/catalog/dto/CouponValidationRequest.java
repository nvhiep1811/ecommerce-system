package com.ecommerce.catalog.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CouponValidationRequest(
        @NotBlank String code,
        @NotNull @DecimalMin("0.0") BigDecimal orderValue
) {
}
