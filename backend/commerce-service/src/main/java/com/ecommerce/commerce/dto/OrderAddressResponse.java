package com.ecommerce.commerce.dto;

public record OrderAddressResponse(
        String fullName,
        String phone,
        String addressLine,
        String city,
        String province,
        String postalCode
) {
}
