package com.ecommerce.commerce.dto;

import com.ecommerce.commerce.model.PaymentStatus;
import com.ecommerce.commerce.model.OrderStatus;

public record PaymentStatusRequest(
    PaymentStatus paymentStatus,
    OrderStatus orderStatus,
    String message
) {
}