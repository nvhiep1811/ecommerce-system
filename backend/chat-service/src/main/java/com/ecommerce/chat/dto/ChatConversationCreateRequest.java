package com.ecommerce.chat.dto;

import jakarta.validation.constraints.NotNull;

public record ChatConversationCreateRequest(
        @NotNull Long productId
) {
}
