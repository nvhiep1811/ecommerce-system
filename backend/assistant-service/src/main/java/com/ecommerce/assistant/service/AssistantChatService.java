package com.ecommerce.assistant.service;

import com.ecommerce.assistant.config.GeminiProperties;
import com.ecommerce.assistant.dto.AssistantActionDto;
import com.ecommerce.assistant.dto.ChatRequest;
import com.ecommerce.assistant.dto.ChatResponse;
import com.ecommerce.assistant.dto.SuggestedProductDto;
import com.google.genai.Client;
import com.google.genai.types.Content;
import com.google.genai.types.FunctionCall;
import com.google.genai.types.FunctionResponse;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AssistantChatService {

    private final Client geminiClient;
    private final GeminiProperties geminiProperties;
    private final AssistantPromptFactory promptFactory;
    private final AssistantToolExecutor toolExecutor;

    public ChatResponse chat(String authorization, ChatRequest request) {
        if (geminiClient == null) {
            return new ChatResponse(
                    request.conversationId(),
                    "Trợ lý AI chưa được cấu hình.",
                    Collections.emptyList(),
                    Collections.emptyList()
            );
        }

        String conversationId = request.conversationId();
        if (conversationId == null || conversationId.isBlank()) {
            conversationId = UUID.randomUUID().toString();
        }

        List<SuggestedProductDto> suggestedProducts = new ArrayList<>();
        List<AssistantActionDto> actions = new ArrayList<>();

        try {
            GenerateContentConfig config = GenerateContentConfig.builder()
                    .systemInstruction(Content.builder().parts(List.of(Part.builder().text(promptFactory.getSystemInstruction()).build())).build())
                    .tools(List.of(promptFactory.getTools()))
                    .temperature(geminiProperties.getTemperature().floatValue())
                    .maxOutputTokens(geminiProperties.getMaxOutputTokens())
                    .build();

            // First call
            GenerateContentResponse response = geminiClient.models.generateContent(
                    geminiProperties.getModel(),
                    Content.builder().parts(List.of(Part.builder().text(request.message()).build())).build(),
                    config
            );

            // Check if there is a function call
            if (response.functionCalls() != null && !response.functionCalls().isEmpty()) {
                FunctionCall functionCall = response.functionCalls().get(0);
                
                // Execute tool
                Map<String, Object> toolResult = toolExecutor.execute(functionCall, authorization, suggestedProducts, actions);

                // Prepare second call
                List<Content> contents = new ArrayList<>();
                contents.add(Content.builder().role("user").parts(List.of(Part.builder().text(request.message()).build())).build());
                if (response.candidates().isPresent() && !response.candidates().get().isEmpty()) {
                    contents.add(Content.builder().role("model").parts(response.candidates().get().get(0).content().get().parts().get()).build());
                }
                contents.add(Content.builder().role("user").parts(List.of(
                        Part.builder().functionResponse(FunctionResponse.builder()
                                .name(functionCall.name().orElse(null))
                                .response(toolResult)
                                .build()).build()
                )).build());

                // Second call
                response = geminiClient.models.generateContent(
                        geminiProperties.getModel(),
                        contents,
                        config
                );
            }

            String answer = response.text();

            return new ChatResponse(conversationId, answer, suggestedProducts, actions);

        } catch (Exception e) {
            log.error("Error communicating with Gemini", e);
            return new ChatResponse(
                    conversationId,
                    "Trợ lý AI đang bận hoặc có lỗi xảy ra, vui lòng thử lại sau.",
                    suggestedProducts,
                    actions
            );
        }
    }
}
