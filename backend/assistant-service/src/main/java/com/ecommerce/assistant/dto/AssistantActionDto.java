package com.ecommerce.assistant.dto;

public record AssistantActionDto(
    String type,
    String label,
    String targetId
) {}
