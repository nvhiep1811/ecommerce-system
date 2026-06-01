package com.ecommerce.user.dto;

public record AuthResponse(
        String accessToken,
        long expiresIn,
        UserProfileResponse user
) {
}
