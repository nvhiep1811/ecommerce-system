package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.FlashSaleProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class KafkaFlashSaleEventPublisher implements FlashSaleEventPublisher {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final FlashSaleProperties properties;

    public KafkaFlashSaleEventPublisher(
            KafkaTemplate<String, String> kafkaTemplate,
            ObjectMapper objectMapper,
            FlashSaleProperties properties
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @Override
    public void publishReservationClaimed(FlashSaleEventPayload payload) {
        if (!properties.getEvents().isKafkaEnabled()) {
            if (properties.getEvents().isPublishRequired()) {
                throw new IllegalStateException("Flash sale Kafka publisher is disabled");
            }
            return;
        }

        try {
            String key = payload.campaignId() + ":" + payload.itemId() + ":" + payload.userId();
            String body = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send(properties.getEvents().getTopic(), key, body)
                    .get(properties.getEvents().getPublishTimeoutMs(), TimeUnit.MILLISECONDS);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize flash sale event", exception);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to publish flash sale event", exception);
        }
    }
}
