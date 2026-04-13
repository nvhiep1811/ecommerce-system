package com.ecommerce.commerce.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record PlaceOrderRequest(
        @NotNull Long addressId,
        String couponCode,
        @NotNull String paymentMethod,
        @NotEmpty List<@Valid OrderLineRequest> items
) {
}
