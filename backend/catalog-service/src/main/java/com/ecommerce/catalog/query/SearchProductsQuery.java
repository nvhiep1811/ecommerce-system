package com.ecommerce.catalog.query;

public record SearchProductsQuery(
        String keyword,
        String categoryId,
        int page,
        int size
) {
}
