package com.ecommerce.catalog.query;

public record GetProductPageQuery(
        int page,
        int size,
        String categoryId,
        String sellerId,
        String keyword
) {
}
