package com.ecommerce.commerce.dto;

import java.util.List;

public record ShippingMethodsResponse(
        List<ShippingMethodResponse> methods
) {
}
