package com.ecommerce.chat.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Registry quan ly WebSocket session theo UUID userId.
 * Mot user co the mo nhieu tab/device -> luu dang Set<Session>.
 */
@Slf4j
@Component
public class ChatSessionRegistry {

    // UUID userId -> tap hop cac session dang active
    private final Map<UUID, Set<WebSocketSession>> userSessions = new ConcurrentHashMap<>();

    // sessionId -> UUID userId
    private final Map<String, UUID> sessionToUser = new ConcurrentHashMap<>();

    // ─── Lifecycle ────────────────────────────────────────────────

    public void register(UUID userId, WebSocketSession session) {
        userSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet()).add(session);
        sessionToUser.put(session.getId(), userId);
        log.info("WS connected: userId={} sessionId={} total={}",
                userId, session.getId(), userSessions.get(userId).size());
    }

    public void remove(WebSocketSession session) {
        UUID userId = sessionToUser.remove(session.getId());
        if (userId != null) {
            Set<WebSocketSession> sessions = userSessions.get(userId);
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    userSessions.remove(userId);
                    log.info("WS fully disconnected: userId={}", userId);
                }
            }
        }
    }

    // ─── Queries ──────────────────────────────────────────────────

    public UUID getUserId(WebSocketSession session) {
        return sessionToUser.get(session.getId());
    }

    public boolean isOnline(UUID userId) {
        Set<WebSocketSession> sessions = userSessions.get(userId);
        return sessions != null && !sessions.isEmpty();
    }

    public Set<WebSocketSession> getSessions(UUID userId) {
        return userSessions.getOrDefault(userId, Collections.emptySet());
    }

    // ─── Send ─────────────────────────────────────────────────────

    public void sendToUser(UUID userId, TextMessage message) {
        Set<WebSocketSession> sessions = getSessions(userId);
        Set<WebSocketSession> closed   = new HashSet<>();

        for (WebSocketSession session : sessions) {
            if (!session.isOpen()) {
                closed.add(session);
                continue;
            }
            try {
                synchronized (session) {
                    session.sendMessage(message);
                }
            } catch (IOException e) {
                log.warn("Failed to send to userId={} sessionId={}: {}",
                        userId, session.getId(), e.getMessage());
                closed.add(session);
            }
        }

        if (!closed.isEmpty()) {
            sessions.removeAll(closed);
            closed.forEach(s -> sessionToUser.remove(s.getId()));
        }
    }
}