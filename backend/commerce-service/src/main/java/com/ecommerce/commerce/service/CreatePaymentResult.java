package com.ecommerce.commerce.service;

import com.fasterxml.jackson.databind.JsonNode;

public record CreatePaymentResult(
        String provider,
        String providerOrderId,
        String checkoutUrl,
        String qrCodeUrl,
        String qrImageBase64,
        String qrContent,
        String bankDeepLink,
        String bankName,
        String bankCode,
        String bankBin,
        String bankAccountNumber,
        String accountName,
        String transferContent,
        JsonNode rawRequest,
        JsonNode rawResponse,
        String gatewayMessage
) {
}
