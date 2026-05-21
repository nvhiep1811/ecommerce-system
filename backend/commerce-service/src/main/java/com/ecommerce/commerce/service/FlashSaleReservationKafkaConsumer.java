package com.ecommerce.commerce.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnProperty(prefix = "flash-sale.events", name = "kafka-enabled", havingValue = "true")
public class FlashSaleReservationKafkaConsumer {

    private final ObjectMapper objectMapper;
    private final FlashSaleReservationSyncService syncService;

    public FlashSaleReservationKafkaConsumer(ObjectMapper objectMapper, FlashSaleReservationSyncService syncService) {
        this.objectMapper = objectMapper;
        this.syncService = syncService;
    }

    @KafkaListener(
            topics = "${flash-sale.events.topic:ecommerce.flash-sale.events}",
            groupId = "${flash-sale.events.reservation-sync-group-id:flash-sale.reservation-sync}"
    )
    public void handle(ConsumerRecord<String, String> record) {
        try {
            FlashSaleEventPayload payload = objectMapper.readValue(record.value(), FlashSaleEventPayload.class);
            syncService.sync(payload);
        } catch (Exception exception) {
            log.error("Failed to sync flash sale event from Kafka topic {} partition {} offset {}",
                    record.topic(), record.partition(), record.offset(), exception);
            throw new IllegalStateException("Failed to sync flash sale reservation event", exception);
        }
    }
}
