package com.ecommerce.assistant.service;

import com.ecommerce.assistant.client.CatalogClient;
import com.ecommerce.assistant.client.CommerceClient;
import com.google.genai.types.FunctionCall;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class AssistantToolExecutorTest {

    @Mock
    private CatalogClient catalogClient;

    @Mock
    private CommerceClient commerceClient;

    @InjectMocks
    private AssistantToolExecutor executor;

    @Test
    void testExecute_UnknownTool() {
        FunctionCall call = FunctionCall.builder()
                .name("unknown_tool")
                .build();

        Map<String, Object> result = executor.execute(call, null, new ArrayList<>(), new ArrayList<>());
        assertTrue(result.containsKey("error"));
        assertEquals("Unknown tool: unknown_tool", result.get("error"));
    }

    @Test
    void testExecute_GetMyOrders_WithoutAuth() {
        FunctionCall call = FunctionCall.builder()
                .name("get_my_orders")
                .build();

        Map<String, Object> result = executor.execute(call, null, new ArrayList<>(), new ArrayList<>());
        assertTrue(result.containsKey("error"));
        assertEquals("AUTH_REQUIRED", result.get("error"));
    }
}
