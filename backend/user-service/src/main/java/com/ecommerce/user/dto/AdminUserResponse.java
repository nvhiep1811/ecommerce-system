package com.ecommerce.user.dto;

import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

public record AdminUserResponse(
        UUID id,
        String email,
        String fullName,
        String avatarUrl,
        String phoneNumber,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String role,
        Set<String> roles
) {
}
