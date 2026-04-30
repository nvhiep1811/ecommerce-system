package com.ecommerce.commerce.service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record CreatePaymentCommand(
        Long orderId,
        String orderNo,
        UUID userId,
        String userEmail,
        String customerName,
        String method,
        String invoiceNumber,
        BigDecimal amount,
        String currency,
        OffsetDateTime expiredAt
) {
}
