package com.ecommerce.catalog.dto;

import java.util.List;

public record ReviewsResponse(
        List<ReviewResponse> items
) {
}
