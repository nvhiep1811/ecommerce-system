package com.ecommerce.commerce.service;

import com.ecommerce.commerce.repository.OutboxEventRepository;
import com.ecommerce.shared.domain.OutboxEvent;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class OutboxServiceTest {

    private final OutboxEventRepository repository = mock(OutboxEventRepository.class);
    private final OutboxService outboxService = new OutboxService(repository, new ObjectMapper());

    @Test
    void publishShouldPersistDebeziumReadyPayloadMetadata() {
        outboxService.publish(
                "ORDER",
                "123",
                "ORDER_CREATED",
                Map.of(
                        "eventId", "existing-event",
                        "eventType", "ORDER_CREATED",
                        "orderCode", "ORD-123"
                )
        );

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(repository).save(captor.capture());

        OutboxEvent event = captor.getValue();
        JsonNode payload = event.getPayload();
        assertEquals("ORDER", event.getAggregateType());
        assertEquals("123", event.getAggregateId());
        assertEquals("ORDER_CREATED", event.getEventType());
        assertEquals("pending", event.getStatus());
        assertEquals("existing-event", payload.path("eventId").asText());
        assertEquals("ORDER_CREATED", payload.path("eventType").asText());
        assertEquals("ORDER", payload.path("aggregateType").asText());
        assertEquals("123", payload.path("aggregateId").asText());
        assertEquals("ORD-123", payload.path("orderCode").asText());
        assertFalse(payload.path("occurredAt").asText().isBlank());
    }
}
