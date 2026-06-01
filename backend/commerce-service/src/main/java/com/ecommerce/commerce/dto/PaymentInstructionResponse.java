package com.ecommerce.commerce.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record PaymentInstructionResponse(
        Long paymentId,
        String status,
        BigDecimal amount,
        String currency,
        String invoiceNumber,
        String qrCodeUrl,
        String qrImageBase64,
        String qrContent,
        String transferContent,
        String bankName,
        String bankCode,
        String bankBin,
        String bankAccountNumber,
        String accountName,
        String bankDeepLink,
        String checkoutUrl,
        OffsetDateTime expiredAt
) {
}
