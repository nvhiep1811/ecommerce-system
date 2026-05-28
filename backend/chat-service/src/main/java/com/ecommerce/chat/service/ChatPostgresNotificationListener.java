package com.ecommerce.chat.service;

import com.ecommerce.chat.websocket.ChatWebSocketSessionRegistry;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
public class ChatPostgresNotificationListener {

    private static final Logger log = LoggerFactory.getLogger(ChatPostgresNotificationListener.class);
    private static final String CHANNEL = "chat_messages_insert";

    private final DataSource dataSource;
    private final ChatService chatService;
    private final ChatWebSocketSessionRegistry sessionRegistry;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean running = true;

    public ChatPostgresNotificationListener(
            DataSource dataSource,
            ChatService chatService,
            ChatWebSocketSessionRegistry sessionRegistry
    ) {
        this.dataSource = dataSource;
        this.chatService = chatService;
        this.sessionRegistry = sessionRegistry;
    }

    @PostConstruct
    void start() {
        executor.submit(this::listen);
    }

    @PreDestroy
    void stop() {
        running = false;
        executor.shutdownNow();
    }

    private void listen() {
        while (running && !Thread.currentThread().isInterrupted()) {
            try (Connection connection = dataSource.getConnection();
                 Statement statement = connection.createStatement()) {
                connection.setAutoCommit(true);
                PGConnection pgConnection = connection.unwrap(PGConnection.class);
                statement.execute("LISTEN " + CHANNEL);
                log.info("Listening for PostgreSQL notifications on {}", CHANNEL);

                while (running && !Thread.currentThread().isInterrupted()) {
                    PGNotification[] notifications = pgConnection.getNotifications(10_000);
                    if (notifications == null) {
                        continue;
                    }
                    for (PGNotification notification : notifications) {
                        handleNotification(notification);
                    }
                }
            } catch (Exception ex) {
                if (running) {
                    log.warn("Chat notification listener will reconnect after failure: {}", ex.getMessage());
                    sleepBeforeReconnect();
                }
            }
        }
    }

    private void handleNotification(PGNotification notification) {
        try {
            Long messageId = Long.valueOf(notification.getParameter());
            sessionRegistry.broadcast(chatService.getMessageForRealtime(messageId));
        } catch (Exception ex) {
            log.warn("Could not process chat notification payload {}", notification.getParameter());
        }
    }

    private void sleepBeforeReconnect() {
        try {
            Thread.sleep(3000);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }
}
