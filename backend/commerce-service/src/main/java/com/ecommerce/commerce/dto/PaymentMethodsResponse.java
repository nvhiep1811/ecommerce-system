package com.ecommerce.commerce.dto;

import java.util.List;

public record PaymentMethodsResponse(
        List<PaymentMethodResponse> methods
) {
}
