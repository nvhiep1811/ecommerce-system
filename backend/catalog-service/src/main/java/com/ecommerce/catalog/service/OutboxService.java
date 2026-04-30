package com.ecommerce.catalog.service;

import com.ecommerce.catalog.repository.OutboxEventRepository;
import com.ecommerce.shared.domain.OutboxEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Slf4j
@Service
public class OutboxService {

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    public OutboxService(OutboxEventRepository outboxEventRepository, ObjectMapper objectMapper) {
        this.outboxEventRepository = outboxEventRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void publish(String aggregateType, String aggregateId, String eventType, Object payload) {
//        try {
//            outboxEventRepository.save(OutboxEvent.builder()
//                    .aggregateType(aggregateType)
//                    .aggregateId(aggregateId)
//                    .eventType(eventType)
//                    .payload(objectMapper.writeValueAsString(payload))
//                    .status("pending")
//                    .build());
//        } catch (JsonProcessingException exception) {
//            throw new IllegalStateException("Failed to serialize outbox payload", exception);
//        }
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
        outboxEventRepository.findTop20ByAggregateTypeAndStatusOrderByCreatedAtAsc("COUPON", "pending")
                .forEach(event -> {
                    log.info("Catalog outbox publish {} {}", event.getEventType(), event.getAggregateId());
                    event.setStatus("published");
                    event.setPublishedAt(OffsetDateTime.now());
                });
    }
}
