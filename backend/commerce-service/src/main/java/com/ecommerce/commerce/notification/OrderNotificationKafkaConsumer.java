package com.ecommerce.commerce.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
    private final ObjectMapper objectMapper;

    public OrderNotificationKafkaConsumer(OrderNotificationConsumer delegate, ObjectMapper objectMapper) {
        this.delegate = delegate;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(
            topics = "#{'${events.kafka.order-events-topics:ecommerce.order.events,ecommerce.ORDER.events}'.split(',')}",
            groupId = "${events.kafka.notification-email-group-id:notification.email.order}"
    )
    public void handle(ConsumerRecord<String, String> record) {
        try {
            delegate.handle(extractEventPayload(record.value()));
        } catch (Exception exception) {
            log.error("Failed to consume order notification event from Kafka topic={}, partition={}, offset={}",
                    record.topic(), record.partition(), record.offset(), exception);
        }
    }

    JsonNode extractEventPayload(String message) throws Exception {
        JsonNode root = objectMapper.readTree(message);
        if (root.isTextual()) {
            root = objectMapper.readTree(root.asText());
        }

        JsonNode directPayload = unwrapPayload(root);
        if (directPayload.hasNonNull("eventType")) {
            return directPayload;
        }

        JsonNode after = root.path("payload").path("after");
        if (after.isMissingNode() || after.isNull()) {
            after = root.path("after");
        }
        if (!after.isMissingNode() && !after.isNull()) {
            JsonNode outboxPayload = unwrapPayload(after.path("payload"));
            if (outboxPayload instanceof ObjectNode objectNode && !objectNode.hasNonNull("eventType")) {
                String eventType = after.path("event_type").asText("");
                if (!eventType.isBlank()) {
                    objectNode.put("eventType", eventType);
                }
            }
            return outboxPayload;
        }

        return root;
    }

    private JsonNode unwrapPayload(JsonNode node) throws Exception {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return objectMapper.createObjectNode();
        }
        if (node.isTextual()) {
            return objectMapper.readTree(node.asText());
        }
        JsonNode payload = node.path("payload");
        if (!payload.isMissingNode() && payload.hasNonNull("eventType")) {
            return payload;
        }
        return node;
    }
}
