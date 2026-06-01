package com.ecommerce.commerce.dto;

public record SepayWebhookResponse(
        boolean success,
        String message
) {
}
