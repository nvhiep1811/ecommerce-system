package com.ecommerce.commerce.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record PlaceOrderRequest(
        @NotNull Long addressId,
        String couponCode,
        String paymentMethod,
        Long shippingMethodId,
        @NotEmpty List<@Valid OrderLineRequest> items
) {
}
