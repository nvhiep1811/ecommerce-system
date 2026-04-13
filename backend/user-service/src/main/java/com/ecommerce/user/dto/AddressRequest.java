package com.ecommerce.user.dto;

import jakarta.validation.constraints.NotBlank;

public record AddressRequest(
        @NotBlank String fullName,
        @NotBlank String phone,
        @NotBlank String addressLine,
        @NotBlank String city,
        String province,
        String postalCode,
        boolean isDefault
) {
}
