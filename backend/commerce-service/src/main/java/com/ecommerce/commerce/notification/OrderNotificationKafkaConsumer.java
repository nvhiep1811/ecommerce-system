package com.ecommerce.commerce.notification;

import com.ecommerce.commerce.events.OutboxKafkaMessageExtractor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnProperty(prefix = "events.kafka", name = "enabled", havingValue = "true")
public class OrderNotificationKafkaConsumer {

    private final OrderNotificationConsumer delegate;
    private final OutboxKafkaMessageExtractor messageExtractor;

    public OrderNotificationKafkaConsumer(OrderNotificationConsumer delegate, OutboxKafkaMessageExtractor messageExtractor) {
        this.delegate = delegate;
        this.messageExtractor = messageExtractor;
    }

    @KafkaListener(
            topics = "#{'${events.kafka.order-events-topics:ecommerce.order.events,ecommerce.ORDER.events}'.split(',')}",
            groupId = "${events.kafka.notification-email-group-id:notification.email.order}"
    )
    public void handle(ConsumerRecord<String, String> record) {
        try {
            delegate.handle(messageExtractor.extractEventPayload(record.value()));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to consume order notification event from Kafka topic="
                    + record.topic() + ", partition=" + record.partition() + ", offset=" + record.offset(), exception);
        }
    }
}
