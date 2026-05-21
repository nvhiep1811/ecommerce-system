package com.ecommerce.commerce.service;

import com.ecommerce.commerce.repository.OutboxEventRepository;
import com.ecommerce.commerce.config.RabbitEventProperties;
import com.ecommerce.shared.domain.OutboxEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.OffsetDateTime;
import java.util.List;

@Slf4j
@Service
public class OutboxService {

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;
    private final ObjectProvider<RabbitTemplate> rabbitTemplateProvider;
    private final RabbitEventProperties rabbitEventProperties;
    private final TransactionTemplate transactionTemplate;

    private static final int MAX_RETRIES = 5;

    @Value("${outbox.relay-enabled:true}")
    private boolean relayEnabled;

    public OutboxService(
            OutboxEventRepository outboxEventRepository,
            ObjectMapper objectMapper,
            ObjectProvider<RabbitTemplate> rabbitTemplateProvider,
            RabbitEventProperties rabbitEventProperties,
            TransactionTemplate transactionTemplate
    ) {
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
        this.rabbitTemplateProvider = rabbitTemplateProvider;
        this.rabbitEventProperties = rabbitEventProperties;
        this.transactionTemplate = transactionTemplate;
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
    public void relay() {
        if (!relayEnabled) {
            return;
        }
        List<OutboxEvent> events = outboxEventRepository.findTop20ByAggregateTypeAndStatusOrderByCreatedAtAsc("ORDER", "pending");
        if (events.isEmpty()) {
            return;
        }

        for (OutboxEvent event : events) {
            if (event.getNextRetryAt() != null && event.getNextRetryAt().isAfter(OffsetDateTime.now())) {
                continue;
            }

            try {
                processEvent(event);
            } catch (Exception exception) {
                log.error("Unexpected error processing outbox event {} {}", event.getEventType(), event.getAggregateId(), exception);
            }
        }
    }

    private void processEvent(OutboxEvent event) {
        try {
            RabbitTemplate rabbitTemplate = rabbitTemplateProvider.getIfAvailable();
            if (rabbitTemplate == null || !rabbitEventProperties.isEnabled()) {
                throw new IllegalStateException("Rabbit outbox relay is disabled; set OUTBOX_RELAY_ENABLED=false when Debezium CDC owns the relay");
            }
            String routingKey = routingKey(event.getEventType());
            rabbitTemplate.convertAndSend(rabbitEventProperties.getExchange(), routingKey, event.getPayload());
            log.info("Commerce outbox published {} {} to {}", event.getEventType(), event.getAggregateId(), routingKey);

            transactionTemplate.executeWithoutResult(status -> {
                OutboxEvent latest = outboxEventRepository.findById(event.getId()).orElse(event);
                latest.setStatus("published");
                latest.setPublishedAt(OffsetDateTime.now());
                outboxEventRepository.save(latest);
            });
        } catch (Exception exception) {
            log.warn("Failed to publish outbox event {} {}: {}", event.getEventType(), event.getAggregateId(), exception.getMessage());
            transactionTemplate.executeWithoutResult(status -> {
                OutboxEvent latest = outboxEventRepository.findById(event.getId()).orElse(event);
                int retryCount = latest.getRetryCount() + 1;
                latest.setRetryCount(retryCount);
                latest.setLastError(exception.getMessage());

                if (retryCount >= MAX_RETRIES) {
                    latest.setStatus("failed");
                    log.error("Outbox event {} {} reached max retries and is marked as FAILED", latest.getEventType(), latest.getAggregateId());
                } else {
                    latest.setNextRetryAt(OffsetDateTime.now().plusSeconds(Math.min(300, retryCount * 30L)));
                }
                outboxEventRepository.save(latest);
            });
        }
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
