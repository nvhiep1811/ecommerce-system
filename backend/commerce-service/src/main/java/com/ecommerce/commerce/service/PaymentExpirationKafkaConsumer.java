package com.ecommerce.commerce.service;

import com.ecommerce.commerce.events.OutboxKafkaMessageExtractor;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;

@Slf4j
@Component
@ConditionalOnProperty(prefix = "payment.expiration-queue", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PaymentExpirationKafkaConsumer {

    private static final String ORDER_PAYMENT_PENDING = "ORDER_PAYMENT_PENDING";

    private final PaymentExpirationDelayQueue delayQueue;
    private final OutboxKafkaMessageExtractor messageExtractor;

    public PaymentExpirationKafkaConsumer(
            PaymentExpirationDelayQueue delayQueue,
            OutboxKafkaMessageExtractor messageExtractor
    ) {
        this.delayQueue = delayQueue;
        this.messageExtractor = messageExtractor;
    }

    @KafkaListener(
            topics = "#{'${events.kafka.order-events-topics:ecommerce.order.events,ecommerce.ORDER.events}'.split(',')}",
            groupId = "${payment.expiration-queue.consumer-group-id:payment.expiration.scheduler}"
    )
    public void handle(ConsumerRecord<String, String> record) {
        try {
            JsonNode payload = messageExtractor.extractEventPayload(record.value());
            if (!ORDER_PAYMENT_PENDING.equals(payload.path("eventType").asText())) {
                return;
            }
            Long paymentId = paymentId(payload);
            OffsetDateTime expiredAt = expiredAt(payload);
            delayQueue.schedule(paymentId, expiredAt);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to schedule payment expiration from Kafka topic="
                    + record.topic() + ", partition=" + record.partition() + ", offset=" + record.offset(), exception);
        }
    }

    private Long paymentId(JsonNode payload) {
        JsonNode paymentId = payload.path("paymentId");
        if (!paymentId.canConvertToLong()) {
            throw new IllegalArgumentException("ORDER_PAYMENT_PENDING event is missing paymentId");
        }
        return paymentId.asLong();
    }

    private OffsetDateTime expiredAt(JsonNode payload) {
        String value = payload.path("expiredAt").asText("");
        if (value.isBlank()) {
            throw new IllegalArgumentException("ORDER_PAYMENT_PENDING event is missing expiredAt");
        }
        try {
            return OffsetDateTime.parse(value);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("ORDER_PAYMENT_PENDING event has invalid expiredAt: " + value, exception);
        }
    }
}
