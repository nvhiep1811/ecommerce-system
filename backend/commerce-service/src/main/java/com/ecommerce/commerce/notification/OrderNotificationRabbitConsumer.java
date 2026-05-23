package com.ecommerce.commerce.notification;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "events.rabbit", name = "enabled", havingValue = "true", matchIfMissing = true)
public class OrderNotificationRabbitConsumer {

    private final OrderNotificationConsumer delegate;

    public OrderNotificationRabbitConsumer(OrderNotificationConsumer delegate) {
        this.delegate = delegate;
    }

    @RabbitListener(queues = "${events.rabbit.notification-email-queue:notification.email.order}")
    public void handle(JsonNode payload) {
        delegate.handle(payload);
    }
}
