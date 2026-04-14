package com.ecommerce.commerce.service;

import com.ecommerce.commerce.repository.OutboxEventRepository;
import com.ecommerce.shared.domain.OutboxEvent;
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
                    log.info("Commerce outbox publish {} {}", event.getEventType(), event.getAggregateId());
                    event.setStatus("published");
                    event.setPublishedAt(OffsetDateTime.now());
                });
    }
}
