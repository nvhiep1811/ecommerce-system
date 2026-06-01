package com.ecommerce.user.dto;

public record UpdateProfileRequest(
        String fullName,
        String phoneNumber,
        String avatarUrl
) {
}
