package com.ecommerce.assistant.service;

import com.ecommerce.assistant.config.GeminiProperties;
import com.ecommerce.assistant.dto.AssistantActionDto;
import com.ecommerce.assistant.dto.ChatRequest;
import com.ecommerce.assistant.dto.ChatResponse;
import com.ecommerce.assistant.dto.ChatStreamResponse;
import com.ecommerce.assistant.dto.SuggestedProductDto;
import com.google.genai.Client;
import com.google.genai.ResponseStream;
import com.google.genai.types.Content;
import com.google.genai.types.FunctionCall;
import com.google.genai.types.FunctionResponse;
import com.google.genai.types.GenerateContentConfig;
import com.google.genai.types.GenerateContentResponse;
import com.google.genai.types.Part;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;
import org.springframework.http.codec.ServerSentEvent;

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

    public Flux<ServerSentEvent<ChatStreamResponse>> chatStream(String authorization, ChatRequest request) {
        String conversationId = request.conversationId();
        if (conversationId == null || conversationId.isBlank()) {
            conversationId = UUID.randomUUID().toString();
        }
        final String cid = conversationId;

        if (geminiClient == null) {
            return Flux.just(ServerSentEvent.<ChatStreamResponse>builder()
                    .data(new ChatStreamResponse(
                            cid,
                            "Trợ lý AI chưa được cấu hình.",
                            Collections.emptyList(),
                            Collections.emptyList(),
                            true
                    ))
                    .build());
        }

        return Flux.<ServerSentEvent<ChatStreamResponse>>create(sink -> {
            List<SuggestedProductDto> suggestedProducts = new ArrayList<>();
            List<AssistantActionDto> actions = new ArrayList<>();
            AtomicReference<ResponseStream<GenerateContentResponse>> activeStream = new AtomicReference<>();

            sink.onCancel(() -> closeActiveStream(activeStream));
            sink.onDispose(() -> closeActiveStream(activeStream));

            try {
                GenerateContentConfig config = GenerateContentConfig.builder()
                        .systemInstruction(Content.builder().parts(List.of(Part.builder().text(promptFactory.getSystemInstruction()).build())).build())
                        .tools(List.of(promptFactory.getTools()))
                        .temperature(geminiProperties.getTemperature().floatValue())
                        .maxOutputTokens(geminiProperties.getMaxOutputTokens())
                        .build();

                List<Content> history = chatSessions.computeIfAbsent(cid, k -> new ArrayList<>());

                Content userContent = Content.builder().role("user").parts(List.of(Part.builder().text(request.message()).build())).build();
                history.add(userContent);

                ResponseStream<GenerateContentResponse> responseStream = geminiClient.models.generateContentStream(
                        geminiProperties.getModel(),
                        history,
                        config
                );

                StringBuilder fullResponse = new StringBuilder();
                boolean isFunctionCall = false;
                FunctionCall functionCall = null;
                GenerateContentResponse firstResponse = null;

                activeStream.set(responseStream);
                try (responseStream) {
                    for (GenerateContentResponse chunk : responseStream) {
                        if (sink.isCancelled()) {
                            return;
                        }
                        if (chunk.functionCalls() != null && !chunk.functionCalls().isEmpty()) {
                            isFunctionCall = true;
                            functionCall = chunk.functionCalls().get(0);
                            firstResponse = chunk;
                            break;
                        }
                        if (chunk.text() != null) {
                            fullResponse.append(chunk.text());
                            sink.next(ServerSentEvent.<ChatStreamResponse>builder()
                                    .data(new ChatStreamResponse(cid, chunk.text(), null, null, false))
                                    .build());
                        }
                    }
                } finally {
                    activeStream.compareAndSet(responseStream, null);
                }

                if (isFunctionCall) {
                    String toolName = functionCall.name().orElse("");
                    String statusMsg = "⏳ Đang xử lý yêu cầu...\n\n";
                    if ("search_products".equals(toolName)) {
                        statusMsg = "⏳ Đang tìm kiếm sản phẩm trong kho...\n\n";
                    } else if ("get_my_orders".equals(toolName) || "get_order_detail".equals(toolName)) {
                        statusMsg = "⏳ Đang truy xuất thông tin đơn hàng của bạn...\n\n";
                    } else if ("add_to_cart".equals(toolName)) {
                        statusMsg = "⏳ Đang thêm sản phẩm vào giỏ hàng...\n\n";
                    }

                    sink.next(ServerSentEvent.<ChatStreamResponse>builder()
                            .data(new ChatStreamResponse(cid, statusMsg, null, null, false))
                            .build());

                    if (sink.isCancelled()) {
                        return;
                    }

                    Map<String, Object> toolResult = toolExecutor.execute(functionCall, authorization, suggestedProducts, actions);

                    if (firstResponse != null && firstResponse.candidates().isPresent() && !firstResponse.candidates().get().isEmpty()
                            && firstResponse.candidates().get().get(0).content().isPresent()) {
                        history.add(firstResponse.candidates().get().get(0).content().get());
                    }

                    Content toolContent = Content.builder().role("user").parts(List.of(
                            Part.builder().functionResponse(FunctionResponse.builder()
                                    .name(functionCall.name().orElse(null))
                                    .response(toolResult)
                                    .build()).build()
                    )).build();
                    history.add(toolContent);

                    ResponseStream<GenerateContentResponse> finalStream = geminiClient.models.generateContentStream(
                            geminiProperties.getModel(),
                            history,
                            config
                    );

                    StringBuilder finalResponseBuilder = new StringBuilder();
                    activeStream.set(finalStream);
                    try (finalStream) {
                        for (GenerateContentResponse chunk : finalStream) {
                            if (sink.isCancelled()) {
                                return;
                            }
                            if (chunk.text() != null) {
                                finalResponseBuilder.append(chunk.text());
                                sink.next(ServerSentEvent.<ChatStreamResponse>builder()
                                        .data(new ChatStreamResponse(cid, chunk.text(), null, null, false))
                                        .build());
                            }
                        }
                    } finally {
                        activeStream.compareAndSet(finalStream, null);
                    }

                    history.add(Content.builder().role("model").parts(List.of(Part.builder().text(finalResponseBuilder.toString()).build())).build());
                } else {
                    history.add(Content.builder().role("model").parts(List.of(Part.builder().text(fullResponse.toString()).build())).build());
                }

                if (history.size() > MAX_HISTORY_SIZE) {
                    while (history.size() > MAX_HISTORY_SIZE) {
                        history.remove(0);
                        while (!history.isEmpty() &&
                               (!"user".equals(history.get(0).role()) ||
                               (history.get(0).parts() != null && history.get(0).parts().isPresent() && !history.get(0).parts().get().isEmpty() && history.get(0).parts().get().get(0).functionResponse() != null))) {
                            history.remove(0);
                        }
                    }
                    chatSessions.put(cid, history);
                }

                sink.next(ServerSentEvent.<ChatStreamResponse>builder()
                        .data(new ChatStreamResponse(cid, "", suggestedProducts, actions, true))
                        .build());
                sink.complete();

            } catch (Exception e) {
                if (sink.isCancelled() || isClientDisconnected(e)) {
                    if (log.isDebugEnabled()) {
                        log.debug("Assistant stream disconnected before completion for conversation {}", cid, e);
                    } else {
                        log.debug("Assistant stream disconnected before completion for conversation {}", cid);
                    }
                    sink.complete();
                    return;
                }

                log.error("Streaming error", e);
                if (!sink.isCancelled()) {
                    sink.next(ServerSentEvent.<ChatStreamResponse>builder()
                            .data(new ChatStreamResponse(cid, "\n[Lỗi kết nối AI]", suggestedProducts, actions, true))
                            .build());
                }
                sink.complete();
            }
        }, reactor.core.publisher.FluxSink.OverflowStrategy.BUFFER).subscribeOn(Schedulers.boundedElastic());
    }

    private void closeActiveStream(AtomicReference<ResponseStream<GenerateContentResponse>> activeStream) {
        ResponseStream<GenerateContentResponse> stream = activeStream.getAndSet(null);
        if (stream == null) {
            return;
        }
        try {
            stream.close();
        } catch (Exception e) {
            log.debug("Failed to close Gemini response stream", e);
        }
    }

    private boolean isClientDisconnected(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current.getClass().equals(InterruptedIOException.class)) {
                return true;
            }

            if ("org.apache.catalina.connector.ClientAbortException".equals(current.getClass().getName())) {
                return true;
            }

            String message = current.getMessage();
            if (message != null) {
                String lowerMessage = message.toLowerCase(Locale.ROOT);
                if (lowerMessage.contains("broken pipe")
                        || lowerMessage.contains("connection reset by peer")
                        || lowerMessage.contains("connection aborted")
                        || lowerMessage.contains("clientabortexception")) {
                    return true;
                }
            }

            if (current instanceof IOException && current.getCause() == null) {
                String className = current.getClass().getSimpleName().toLowerCase(Locale.ROOT);
                if (className.contains("clientabort")) {
                    return true;
                }
            }

            current = current.getCause();
        }
        return false;
    }
}
