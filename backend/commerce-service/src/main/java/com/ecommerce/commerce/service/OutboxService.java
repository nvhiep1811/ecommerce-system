package com.ecommerce.commerce.service;

import com.ecommerce.commerce.repository.OutboxEventRepository;
import com.ecommerce.commerce.config.RabbitEventProperties;
import com.ecommerce.shared.domain.OutboxEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Slf4j
@Service
public class OutboxService {

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;
    private final RabbitTemplate rabbitTemplate;
    private final RabbitEventProperties rabbitEventProperties;

    public OutboxService(
            OutboxEventRepository outboxEventRepository,
            ObjectMapper objectMapper,
            RabbitTemplate rabbitTemplate,
            RabbitEventProperties rabbitEventProperties
    ) {
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
        this.rabbitTemplate = rabbitTemplate;
        this.rabbitEventProperties = rabbitEventProperties;
    }

    @Transactional
    public void publish(String aggregateType, String aggregateId, String eventType, Object payload) {
        outboxEventRepository.save(OutboxEvent.builder()
                .aggregateType(aggregateType)
                .aggregateId(aggregateId)
                .eventType(eventType)
                .payload(objectMapper.valueToTree(payload))
                .status("pending")
                .build());
    }

    @Scheduled(fixedDelayString = "${outbox.relay-delay-ms:10000}")
    @Transactional
    public void relay() {
        outboxEventRepository.findTop20ByStatusOrderByCreatedAtAsc("pending")
                .forEach(event -> {
                    if (event.getNextRetryAt() != null && event.getNextRetryAt().isAfter(OffsetDateTime.now())) {
                        return;
                    }
                    try {
                        String routingKey = routingKey(event.getEventType());
                        rabbitTemplate.convertAndSend(rabbitEventProperties.getExchange(), routingKey, event.getPayload());
                        log.info("Commerce outbox published {} {} to {}", event.getEventType(), event.getAggregateId(), routingKey);
                        event.setStatus("published");
                        event.setPublishedAt(OffsetDateTime.now());
                    } catch (AmqpException exception) {
                        int retryCount = event.getRetryCount() + 1;
                        event.setRetryCount(retryCount);
                        event.setNextRetryAt(OffsetDateTime.now().plusSeconds(Math.min(300, retryCount * 30L)));
                        event.setLastError(exception.getMessage());
                        log.warn("Failed to publish outbox event {} {}: {}", event.getEventType(), event.getAggregateId(), exception.getMessage());
                    }
                });
    }

    private String routingKey(String eventType) {
        return switch (eventType) {
            case "ORDER_CREATED" -> "order.created";
            case "ORDER_PAYMENT_PENDING" -> "order.payment.pending";
            case "ORDER_PAID" -> "order.paid";
            case "PAYMENT_FAILED" -> "order.payment.failed";
            case "PAYMENT_EXPIRED" -> "order.payment.expired";
            case "PAYMENT_MISMATCH" -> "order.payment.mismatch";
            case "ORDER_STATUS_CHANGED" -> "order.status.changed";
            default -> "order.event";
        };
    }
}
