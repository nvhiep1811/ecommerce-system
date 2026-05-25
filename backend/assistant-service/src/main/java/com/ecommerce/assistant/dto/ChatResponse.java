package com.ecommerce.assistant.dto;

import java.util.List;

public record ChatResponse(
    String conversationId,
    String answer,
    List<SuggestedProductDto> suggestedProducts,
    List<AssistantActionDto> actions
) {}
