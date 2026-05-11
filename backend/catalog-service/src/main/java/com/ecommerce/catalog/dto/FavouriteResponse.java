package com.ecommerce.catalog.dto;

import java.time.OffsetDateTime;

public record FavouriteResponse(
        Long id,
        ProductResponse product,
        OffsetDateTime createdAt
) {
}
