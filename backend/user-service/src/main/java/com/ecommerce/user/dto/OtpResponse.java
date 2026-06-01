package com.ecommerce.user.dto;

public record OtpResponse(
        String message,
        long expiresInSeconds
) {
}
