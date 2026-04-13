package com.ecommerce.user.dto;

public record AuthResponse(
        String accessToken,
        UserProfileResponse user
) {
}
