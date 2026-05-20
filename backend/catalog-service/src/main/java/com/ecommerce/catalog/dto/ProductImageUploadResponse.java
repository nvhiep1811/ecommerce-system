package com.ecommerce.catalog.dto;

public record ProductImageUploadResponse(
        String objectPath,
        String publicUrl
) {
}
