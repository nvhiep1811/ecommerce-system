package com.ecommerce.catalog.dto;

public record FavouriteStatusResponse(
        Long productId,
        boolean favourite
) {
}
