package com.ecommerce.commerce.dto;

import java.util.UUID;

public record AddressSnapshotResponse(
        Long id,
        UUID userId,
        String fullName,
        String phone,
        String addressLine,
        String city,
        String province,
        String postalCode,
        boolean isDefault
) {
}
