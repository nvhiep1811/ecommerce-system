package com.ecommerce.commerce.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record FlashSaleClaimRequest(
        @NotBlank String requestId,
        @Min(1) @Max(99) Integer quantity
) {
}
