package com.ecommerce.chat.config;

import com.ecommerce.chat.websocket.ChatWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.*;

/**
 * Đăng ký WebSocket endpoint thuần (không STOMP, không SockJS).
 *
 * Client kết nối: ws://localhost:8080/ws/chat?token=<JWT>
 */
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final ChatWebSocketHandler chatWebSocketHandler;

    @Value("${app.websocket.allowed-origins:*}")
    private String[] allowedOrigins;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry
            .addHandler(chatWebSocketHandler, "/ws/chat")
            .setAllowedOriginPatterns("*");  // Thay "*" bằng domain cụ thể khi production
            // Không gọi .withSockJS() vì đang dùng WebSocket thuần
    }
}
