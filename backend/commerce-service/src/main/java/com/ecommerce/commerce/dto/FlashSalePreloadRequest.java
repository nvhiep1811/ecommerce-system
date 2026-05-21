package com.ecommerce.commerce.dto;

import jakarta.validation.constraints.Min;

public record FlashSalePreloadRequest(
        @Min(0) Integer stock,
        @Min(1) Integer perUserLimit
) {
}
