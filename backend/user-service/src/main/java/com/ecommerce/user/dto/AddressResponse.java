package com.ecommerce.user.dto;

import java.util.UUID;

public record AddressResponse(
        Long id,
        UUID userId,
        String fullName,
        String phone,
        String addressLine,
        String ward,
        String district,
        String city,
        String province,
        String postalCode,
        String country,
        boolean isDefault
) {
}
