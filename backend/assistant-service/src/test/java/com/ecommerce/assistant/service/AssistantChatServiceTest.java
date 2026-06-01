package com.ecommerce.assistant.service;

import com.ecommerce.assistant.config.GeminiProperties;
import com.ecommerce.assistant.dto.ChatRequest;
import com.ecommerce.assistant.dto.ChatResponse;
import com.ecommerce.assistant.dto.ChatStreamResponse;
import com.google.genai.Client;
import com.google.genai.types.Tool;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.codec.ServerSentEvent;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssistantChatServiceTest {

    @Mock
    private Client geminiClient;

    @Mock
    private GeminiProperties geminiProperties;

    @Mock
    private AssistantPromptFactory promptFactory;

    @Mock
    private AssistantToolExecutor toolExecutor;

    @InjectMocks
    private AssistantChatService assistantChatService;

    @Test
    void testChat_UnconfiguredClient_ReturnsErrorMessage() {
        AssistantChatService serviceWithoutClient = new AssistantChatService(null, geminiProperties, promptFactory, toolExecutor);
        ChatRequest request = new ChatRequest("hello", "conv-1");
        
        ChatResponse response = serviceWithoutClient.chat(null, request);
        
        assertEquals("conv-1", response.conversationId());
        assertEquals("Trợ lý AI chưa được cấu hình.", response.answer());
        assertEquals(0, response.suggestedProducts().size());
    }

    @Test
    void testChat_Exception_ReturnsFallbackMessage() {
        ChatRequest request = new ChatRequest("hello", "conv-1");
        when(promptFactory.getSystemInstruction()).thenReturn("system");
        when(promptFactory.getTools()).thenReturn(Tool.builder().build());
        when(geminiProperties.getTemperature()).thenThrow(new RuntimeException("Test Error"));

        ChatResponse response = assistantChatService.chat(null, request);
        
        assertNotNull(response);
        assertEquals("Trợ lý AI đang bận hoặc có lỗi xảy ra, vui lòng thử lại sau.", response.answer());
    }

    @Test
    void testChatStream_UnconfiguredClient_ReturnsFinalErrorEvent() {
        AssistantChatService serviceWithoutClient = new AssistantChatService(null, geminiProperties, promptFactory, toolExecutor);
        ChatRequest request = new ChatRequest("hello", "conv-1");

        List<ServerSentEvent<ChatStreamResponse>> events = serviceWithoutClient.chatStream(null, request)
                .collectList()
                .block();

        assertNotNull(events);
        assertEquals(1, events.size());
        ChatStreamResponse response = events.get(0).data();
        assertNotNull(response);
        assertEquals("conv-1", response.conversationId());
        assertEquals("Trợ lý AI chưa được cấu hình.", response.textChunk());
        assertTrue(response.isDone());
        assertNotNull(response.suggestedProducts());
        assertTrue(response.suggestedProducts().isEmpty());
        assertNotNull(response.actions());
        assertTrue(response.actions().isEmpty());
    }
}
