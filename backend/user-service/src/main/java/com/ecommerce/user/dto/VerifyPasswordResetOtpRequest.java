package com.ecommerce.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record VerifyPasswordResetOtpRequest(
        @Email @NotBlank String email,
        @NotBlank @Pattern(regexp = "\\d{4,8}") String otp
) {
}
