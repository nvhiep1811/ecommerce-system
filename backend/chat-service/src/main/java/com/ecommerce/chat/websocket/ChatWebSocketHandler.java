package com.ecommerce.chat.websocket;

import com.ecommerce.chat.service.ChatService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.UUID;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    public static final String USER_ID_ATTRIBUTE = "userId";

    private final ObjectMapper objectMapper;
    private final ChatService chatService;
    private final ChatWebSocketSessionRegistry sessionRegistry;

    public ChatWebSocketHandler(
            ObjectMapper objectMapper,
            ChatService chatService,
            ChatWebSocketSessionRegistry sessionRegistry
    ) {
        this.objectMapper = objectMapper;
        this.chatService = chatService;
        this.sessionRegistry = sessionRegistry;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        UUID userId = (UUID) session.getAttributes().get(USER_ID_ATTRIBUTE);
        if (userId != null && sessionRegistry.registerUser(userId, session)) {
            sessionRegistry.broadcastPresence(userId, true);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        UUID userId = (UUID) session.getAttributes().get(USER_ID_ATTRIBUTE);
        if (userId == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Missing user"));
            return;
        }

        JsonNode payload = objectMapper.readTree(message.getPayload());
        String type = payload.path("type").asText();
        if (!"subscribe".equals(type)) {
            return;
        }

        long conversationId = payload.path("conversationId").asLong(0);
        if (conversationId <= 0) {
            return;
        }

        chatService.assertCanAccess(userId, conversationId);
        sessionRegistry.subscribe(conversationId, session);
        session.sendMessage(new TextMessage("{\"type\":\"subscribed\",\"conversationId\":" + conversationId + "}"));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        UUID userId = (UUID) session.getAttributes().get(USER_ID_ATTRIBUTE);
        if (sessionRegistry.remove(session) && userId != null) {
            sessionRegistry.broadcastPresence(userId, false);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        UUID userId = (UUID) session.getAttributes().get(USER_ID_ATTRIBUTE);
        if (sessionRegistry.remove(session) && userId != null) {
            sessionRegistry.broadcastPresence(userId, false);
        }
    }
}
