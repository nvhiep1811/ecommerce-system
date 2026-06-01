package com.ecommerce.catalog.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ReviewUpsertRequest(
        @NotNull Long productId,
        @NotNull Long orderItemId,
        @NotNull @Min(1) @Max(5) Integer rating,
        @Size(max = 2000) String comment,
        List<@Size(max = 1000) String> imageUrls
) {
}
