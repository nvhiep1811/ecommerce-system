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
        @NotEmpty List<@Valid OrderLineRequest> items,
        String clientRequestId
) {
    public PlaceOrderRequest(
            Long addressId,
            String couponCode,
            String paymentMethod,
            Long shippingMethodId,
            List<OrderLineRequest> items
    ) {
        this(addressId, couponCode, paymentMethod, shippingMethodId, items, null);
    }
}
