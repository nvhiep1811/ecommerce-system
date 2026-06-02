package com.ecommerce.commerce.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;

public record AdminFlashSaleCreateRequest(
        @NotBlank String name,
        String status,
        @NotNull OffsetDateTime startsAt,
        @NotNull OffsetDateTime endsAt,
        Boolean preloadStock,
        @Valid @Size(min = 1, max = 100) List<AdminFlashSaleItemRequest> items
) {
}
