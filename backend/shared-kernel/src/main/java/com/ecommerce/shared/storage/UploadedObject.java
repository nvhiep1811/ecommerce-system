package com.ecommerce.shared.storage;

public record UploadedObject(
        String objectKey,
        String publicUrl,
        String contentType,
        long sizeBytes
) {
}
