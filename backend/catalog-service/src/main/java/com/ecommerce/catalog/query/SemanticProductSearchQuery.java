package com.ecommerce.catalog.query;

public record SemanticProductSearchQuery(
        String query,
        int topK
) {
}
