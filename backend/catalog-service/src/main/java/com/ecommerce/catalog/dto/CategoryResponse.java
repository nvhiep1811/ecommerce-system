package com.ecommerce.catalog.dto;

public record CategoryResponse(
        Long id,
        Long parentId,
        String name
) {
}
