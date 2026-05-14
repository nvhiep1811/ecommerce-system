package com.ecommerce.catalog.dto;

import java.util.List;

public record FavouritesResponse(
        List<FavouriteResponse> items
) {
}
