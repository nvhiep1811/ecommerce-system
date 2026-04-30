package com.ecommerce.commerce.dto;

import java.time.OffsetDateTime;

public record PaymentStatusResponse(
        Long orderId,
        String orderCode,
        String orderStatus,
        String paymentStatus,
        String paymentMethod,
        OffsetDateTime paidAt,
        String message
) {
}
