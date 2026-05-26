package com.ecommerce.assistant.dto;

import jakarta.validation.constraints.NotBlank;

public record ChatRequest(
    @NotBlank(message = "Message must not be blank")
    String message,
    String conversationId
) {}
