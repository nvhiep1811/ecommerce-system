package com.ecommerce.commerce.service;

import com.ecommerce.commerce.event.FlashSaleClaimedEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class FlashSaleReadModelConsumer {

    private final FlashSaleReadModelService readModelService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public FlashSaleReadModelConsumer(FlashSaleReadModelService readModelService) {
        this.readModelService = readModelService;
    }

    @KafkaListener(topics = "flashsale-claimed", groupId = "flashsale-readmodel", containerFactory = "flashSaleKafkaBatchListenerContainerFactory")
    public void handleClaimedEvent(String message) {
        try {
            FlashSaleClaimedEvent event = objectMapper.readValue(message, FlashSaleClaimedEvent.class);
            // Idempotency check can be inside service
            readModelService.applyClaimedEvent(event);
        } catch (Exception e) {
            // Log the error – in a real system use a logger
            System.err.println("Failed to process FlashSaleClaimedEvent: " + e.getMessage());
        }
    }
}
