package com.ecommerce.catalog.service;

import com.ecommerce.catalog.repository.OutboxEventRepository;
import com.ecommerce.shared.domain.OutboxEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

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
                .payload(eventPayload(aggregateType, aggregateId, eventType, payload))
                .status("pending")
                .build());
    }

    private JsonNode eventPayload(String aggregateType, String aggregateId, String eventType, Object payload) {
        JsonNode json = objectMapper.valueToTree(payload);
        ObjectNode object;
        if (json instanceof ObjectNode objectNode) {
            object = objectNode;
        } else {
            object = objectMapper.createObjectNode();
            object.set("payload", json);
        }
        putIfMissing(object, "eventId", UUID.randomUUID().toString());
        putIfMissing(object, "eventType", eventType);
        putIfMissing(object, "aggregateType", aggregateType);
        putIfMissing(object, "aggregateId", aggregateId);
        putIfMissing(object, "occurredAt", OffsetDateTime.now().toString());
        return object;
    }

    private void putIfMissing(ObjectNode object, String field, String value) {
        if (!object.hasNonNull(field)) {
            object.put(field, value);
        }
    }
}
