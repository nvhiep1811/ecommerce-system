package com.ecommerce.user.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserProfileResponse(
        UUID id,
        String email,
        String fullName,
        String avatarUrl,
        String phoneNumber,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String role
) {
}
