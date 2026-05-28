package com.ecommerce.assistant.dto;

import java.util.List;

public record ChatStreamResponse(
        String conversationId,
        String textChunk,
        List<SuggestedProductDto> suggestedProducts,
        List<AssistantActionDto> actions,
        boolean isDone
) {
}
