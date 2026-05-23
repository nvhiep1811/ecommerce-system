package com.ecommerce.chat.websocket;

import com.ecommerce.chat.dto.*;
import com.ecommerce.chat.enums.MessageType;
import com.ecommerce.chat.service.ChatService;
import com.ecommerce.shared.security.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final ChatSessionRegistry registry;
    private final ChatService          chatService;
    private final JwtService           jwtService;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    // ─── Lifecycle ────────────────────────────────────────────────

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String token = extractToken(session);
        UUID userId;
        String role;
        try {
            Claims claims = jwtService.parse(token);
            userId = UUID.fromString(claims.getSubject());
            List<String> roles = claims.get("roles", List.class);
            role = (roles != null && !roles.isEmpty()) ? roles.get(0) : "CUSTOMER";
        } catch (Exception e) {
            log.warn("WS reject - invalid token, sessionId={}", session.getId());
            session.close(CloseStatus.NOT_ACCEPTABLE.withReason("Invalid token"));
            return;
        }

        session.getAttributes().put("userId", userId);
        session.getAttributes().put("role",   role);

        registry.register(userId, session);

        sendToSession(session, WsFrame.of("CONNECTED",
                Map.of("userId", userId.toString(), "message", "Connected successfully")));

        sendToSession(session, WsFrame.of("UNREAD_COUNT", chatService.getTotalUnread(userId)));

        log.info("WS connected: userId={} sessionId={}", userId, session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        UUID userId = (UUID) session.getAttributes().get("userId");
        if (userId == null) {
            sendToSession(session, WsFrame.error("Session not authenticated"));
            return;
        }

        WsFrame frame;
        try {
            frame = objectMapper.readValue(message.getPayload(), WsFrame.class);
        } catch (Exception e) {
            sendToSession(session, WsFrame.error("Invalid JSON: " + e.getMessage()));
            return;
        }

        try {
            switch (frame.getType()) {
                case "SEND_MESSAGE" -> handleSendMessage(session, userId, frame);
                case "MARK_READ"    -> handleMarkRead(session, userId, frame);
                case "TYPING"       -> handleTyping(session, userId, frame);
                default             -> sendToSession(session,
                        WsFrame.error("Unsupported event type: " + frame.getType()));
            }
        } catch (Exception e) {
            log.error("WS handler error: userId={} type={}", userId, frame.getType(), e);
            sendToSession(session, WsFrame.error(e.getMessage()));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        UUID userId = (UUID) session.getAttributes().get("userId");
        registry.remove(session);
        log.info("WS disconnected: userId={} sessionId={} status={}", userId, session.getId(), status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.error("WS transport error: sessionId={}", session.getId(), exception);
        registry.remove(session);
    }

    // ─── Event handlers ───────────────────────────────────────────

    private void handleSendMessage(WebSocketSession session, UUID userId, WsFrame frame) throws Exception {
        WsSendMessageDto req = toPayload(frame.getPayload(), WsSendMessageDto.class);

        if (req.getConversationId() == null) {
            sendToSession(session, WsFrame.error("conversationId is required"));
            return;
        }
        if (req.getMessageType() == null) req.setMessageType(MessageType.TEXT);
        if (req.getMessageType() == MessageType.TEXT
                && (req.getContent() == null || req.getContent().isBlank())) {
            sendToSession(session, WsFrame.error("Message content cannot be empty"));
            return;
        }

        String role = (String) session.getAttributes().get("role");
        MessageResponseDto saved = chatService.sendMessage(userId, role, req);
        WsFrame outFrame = WsFrame.of("NEW_MESSAGE", saved);

        // Gui lai cho sender (confirm)
        sendToUser(userId, outFrame);

        // Gui cho receiver
        UUID receiverId = chatService.getOtherParticipant(req.getConversationId(), userId);
        if (receiverId != null && registry.isOnline(receiverId)) {
            sendToUser(receiverId, outFrame);
        }

        // Cap nhat unread badge cho receiver
        if (receiverId != null) {
            sendToUser(receiverId, WsFrame.of("UNREAD_COUNT", chatService.getTotalUnread(receiverId)));
        }
    }

    private void handleMarkRead(WebSocketSession session, UUID userId, WsFrame frame) throws Exception {
        WsMarkReadDto req = toPayload(frame.getPayload(), WsMarkReadDto.class);
        chatService.markAsRead(req.getConversationId(), userId);

        UUID otherId = chatService.getOtherParticipant(req.getConversationId(), userId);
        if (otherId != null && registry.isOnline(otherId)) {
            sendToUser(otherId, WsFrame.of("MESSAGE_READ", Map.of(
                    "conversationId", req.getConversationId(),
                    "readByUserId",   userId.toString()
            )));
        }

        sendToUser(userId, WsFrame.of("UNREAD_COUNT", chatService.getTotalUnread(userId)));
    }

    private void handleTyping(WebSocketSession session, UUID userId, WsFrame frame) throws Exception {
        WsTypingDto req  = toPayload(frame.getPayload(), WsTypingDto.class);
        UUID     otherId = chatService.getOtherParticipant(req.getConversationId(), userId);

        if (otherId != null && registry.isOnline(otherId)) {
            sendToUser(otherId, WsFrame.of("TYPING_INDICATOR", Map.of(
                    "conversationId", req.getConversationId(),
                    "userId",         userId.toString(),
                    "isTyping",       req.isTyping()
            )));
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────

    private String extractToken(WebSocketSession session) {
        String query = session.getUri() != null ? session.getUri().getQuery() : null;
        if (query != null) {
            for (String part : query.split("&")) {
                if (part.startsWith("token=")) return part.substring(6);
            }
        }
        var authHeader = session.getHandshakeHeaders().getFirst("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }

    private void sendToSession(WebSocketSession session, WsFrame frame) throws Exception {
        if (session.isOpen()) {
            synchronized (session) {
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(frame)));
            }
        }
    }

    private void sendToUser(UUID userId, WsFrame frame) {
        try {
            registry.sendToUser(userId,
                    new TextMessage(objectMapper.writeValueAsString(frame)));
        } catch (Exception e) {
            log.error("Failed to send WsFrame to userId={}", userId, e);
        }
    }

    private <T> T toPayload(Object raw, Class<T> clazz) {
        return objectMapper.convertValue(raw, clazz);
    }
}