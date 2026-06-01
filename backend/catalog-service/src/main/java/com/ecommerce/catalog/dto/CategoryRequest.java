package com.ecommerce.catalog.dto;

public record CategoryRequest(
        Long parentId,
        String name,
        String slug,
        String description,
        String imageUrl,
        Boolean active
) {

}

