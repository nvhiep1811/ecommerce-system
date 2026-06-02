package com.ecommerce.commerce.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record AdminFlashSaleItemRequest(
        @NotNull Long productId,
        Long variantId,
        @NotNull @DecimalMin("0.01") BigDecimal salePrice,
        @NotNull @Min(0) Integer stockLimit,
        @NotNull @Min(1) Integer perUserLimit,
        String status
) {
}
