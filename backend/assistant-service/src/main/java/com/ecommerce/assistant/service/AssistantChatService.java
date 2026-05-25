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
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class AssistantChatService {

    private final Client geminiClient;
    private final GeminiProperties geminiProperties;
    private final AssistantPromptFactory promptFactory;
    private final AssistantToolExecutor toolExecutor;

    private final Map<String, List<Content>> chatSessions = new ConcurrentHashMap<>();
    private static final int MAX_HISTORY_SIZE = 12; // 12 parts = ~6 turns

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

            // Lấy hoặc khởi tạo lịch sử
            List<Content> history = chatSessions.computeIfAbsent(conversationId, k -> new ArrayList<>());
            
            // Thêm câu hỏi hiện tại vào lịch sử
            Content userContent = Content.builder().role("user").parts(List.of(Part.builder().text(request.message()).build())).build();
            history.add(userContent);

            // Gửi toàn bộ lịch sử lên AI
            GenerateContentResponse response = geminiClient.models.generateContent(
                    geminiProperties.getModel(),
                    history,
                    config
            );

            // Xử lý Tool Calling nếu có
            if (response.functionCalls() != null && !response.functionCalls().isEmpty()) {
                FunctionCall functionCall = response.functionCalls().get(0);
                
                // Thực thi tool
                Map<String, Object> toolResult = toolExecutor.execute(functionCall, authorization, suggestedProducts, actions);

                // Lưu phản hồi (lệnh gọi hàm) của AI vào lịch sử
                if (response.candidates().isPresent() && !response.candidates().get().isEmpty()
                        && response.candidates().get().get(0).content().isPresent()) {
                    history.add(response.candidates().get().get(0).content().get());
                }

                // Lưu kết quả của hàm vào lịch sử (dưới dạng user response)
                Content toolContent = Content.builder().role("user").parts(List.of(
                        Part.builder().functionResponse(FunctionResponse.builder()
                                .name(functionCall.name().orElse(null))
                                .response(toolResult)
                                .build()).build()
                )).build();
                history.add(toolContent);

                // Gọi AI lần 2 với kết quả tool
                response = geminiClient.models.generateContent(
                        geminiProperties.getModel(),
                        history,
                        config
                );
            }

            // Lưu câu trả lời cuối cùng của AI vào lịch sử
            if (response.candidates().isPresent() && !response.candidates().get().isEmpty()
                    && response.candidates().get().get(0).content().isPresent()) {
                history.add(response.candidates().get().get(0).content().get());
            }

            // Cắt ngắn lịch sử nếu quá dài để tránh tràn context
            if (history.size() > MAX_HISTORY_SIZE) {
                while (history.size() > MAX_HISTORY_SIZE) {
                    history.remove(0);
                    // Đảm bảo lịch sử luôn bắt đầu bằng câu hỏi của user (không phải model, không phải function response)
                    while (!history.isEmpty() && 
                           (!"user".equals(history.get(0).role()) || 
                           (history.get(0).parts() != null && history.get(0).parts().isPresent() && !history.get(0).parts().get().isEmpty() && history.get(0).parts().get().get(0).functionResponse() != null))) {
                        history.remove(0);
                    }
                }
                chatSessions.put(conversationId, history);
            }

            String answer = response.text();

            return new ChatResponse(conversationId, answer, suggestedProducts, actions);

        } catch (Exception e) {
            log.error("Error communicating with Gemini: {} - {}", e.getClass().getName(), e.getMessage(), e);
            return new ChatResponse(
                    conversationId,
                    "Trợ lý AI đang bận hoặc có lỗi xảy ra, vui lòng thử lại sau.",
                    suggestedProducts,
                    actions
            );
        }
    }
}
