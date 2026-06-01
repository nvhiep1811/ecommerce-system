package com.ecommerce.chat.dto;

import java.util.List;

public record ChatMessagesResponse(
        List<ChatMessageResponse> items
) {
}
