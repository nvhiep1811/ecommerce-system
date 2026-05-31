package com.ecommerce.user.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateUserStatusRequest(
        @NotBlank String status
) {
}
