package com.ecommerce.user.dto;

public record PasswordResetTokenResponse(
        String resetToken,
        long expiresInSeconds
) {
}
