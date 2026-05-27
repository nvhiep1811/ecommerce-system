package com.ecommerce.commerce.events;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

@Component
public class OutboxKafkaMessageExtractor {

    private final ObjectMapper objectMapper;

    public OutboxKafkaMessageExtractor(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public JsonNode extractEventPayload(String message) throws Exception {
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
            if (outboxPayload instanceof ObjectNode objectNode) {
                putIfMissing(objectNode, "eventId", after.path("id").asText(""));
                putIfMissing(objectNode, "eventType", after.path("event_type").asText(""));
                putIfMissing(objectNode, "aggregateType", after.path("aggregate_type").asText(""));
                putIfMissing(objectNode, "aggregateId", after.path("aggregate_id").asText(""));
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

    private void putIfMissing(ObjectNode node, String field, String value) {
        if (!node.hasNonNull(field) && value != null && !value.isBlank()) {
            node.put(field, value);
        }
    }
}
