package com.ecommerce.commerce.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record OrderQuoteRequest(
        Long addressId,
        String couponCode,
        String paymentMethod,
        Long shippingMethodId,
        @NotEmpty List<@Valid OrderLineRequest> items
) {
}
