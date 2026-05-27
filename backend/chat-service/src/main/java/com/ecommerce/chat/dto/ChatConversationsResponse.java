package com.ecommerce.chat.dto;

import java.util.List;

public record ChatConversationsResponse(
        List<ChatConversationResponse> items
) {
}
