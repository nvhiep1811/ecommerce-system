package com.ecommerce.chat.websocket;

import com.ecommerce.chat.dto.ChatMessageResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class ChatWebSocketSessionRegistry {

    private final ObjectMapper objectMapper;
    private final Map<Long, Set<WebSocketSession>> sessionsByConversation = new ConcurrentHashMap<>();
    private final Map<UUID, Set<WebSocketSession>> sessionsByUser = new ConcurrentHashMap<>();

    public ChatWebSocketSessionRegistry(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void subscribe(Long conversationId, WebSocketSession session) {
        sessionsByConversation.computeIfAbsent(conversationId, ignored -> new CopyOnWriteArraySet<>()).add(session);
    }

    public boolean registerUser(UUID userId, WebSocketSession session) {
        Set<WebSocketSession> sessions = sessionsByUser.computeIfAbsent(userId, ignored -> new CopyOnWriteArraySet<>());
        boolean wasOffline = sessions.stream().noneMatch(WebSocketSession::isOpen);
        sessions.add(session);
        return wasOffline;
    }

    public boolean remove(WebSocketSession session) {
        UUID removedUserId = null;
        sessionsByConversation.values().forEach(sessions -> sessions.remove(session));
        for (Map.Entry<UUID, Set<WebSocketSession>> entry : sessionsByUser.entrySet()) {
            if (entry.getValue().remove(session)) {
                removedUserId = entry.getKey();
                break;
            }
        }
        return removedUserId != null && !isUserOnline(removedUserId);
    }

    public boolean isUserOnline(UUID userId) {
        Set<WebSocketSession> sessions = sessionsByUser.get(userId);
        return sessions != null && sessions.stream().anyMatch(WebSocketSession::isOpen);
    }

    public void broadcastPresence(UUID userId, boolean online) {
        broadcastToAll(new PresenceEvent("presence", userId, online));
    }

    public void broadcastRead(Long conversationId, UUID readerId) {
        broadcastToConversation(conversationId, new ReadEvent("read", conversationId, readerId));
    }

    public void broadcast(ChatMessageResponse message) {
        broadcastToConversation(message.conversationId(), new ChatMessageEvent("message", message));
    }

    private void broadcastToConversation(Long conversationId, Object event) {
        Set<WebSocketSession> sessions = sessionsByConversation.get(conversationId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        TextMessage payload = toTextMessage(event);
        if (payload == null) return;

        for (WebSocketSession session : sessions) {
            send(session, payload);
        }
    }

    private void broadcastToAll(Object event) {
        TextMessage payload = toTextMessage(event);
        if (payload == null) return;

        sessionsByUser.values().forEach(sessions -> sessions.forEach(session -> send(session, payload)));
    }

    private TextMessage toTextMessage(Object event) {
        try {
            return new TextMessage(objectMapper.writeValueAsString(event));
        } catch (JsonProcessingException ignored) {
            return null;
        }
    }

    private void send(WebSocketSession session, TextMessage payload) {
        if (!session.isOpen()) {
            remove(session);
            return;
        }
        try {
            session.sendMessage(payload);
        } catch (IOException ignored) {
            remove(session);
        }
    }

    private record ChatMessageEvent(String type, ChatMessageResponse message) {
    }

    private record PresenceEvent(String type, UUID userId, boolean online) {
    }

    private record ReadEvent(String type, Long conversationId, UUID readerId) {
    }
}
