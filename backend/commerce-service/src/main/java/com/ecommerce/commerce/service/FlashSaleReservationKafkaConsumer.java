package com.ecommerce.commerce.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

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
            groupId = "${flash-sale.events.reservation-sync-group-id:flash-sale.reservation-sync}",
            containerFactory = "flashSaleKafkaBatchListenerContainerFactory"
    )
    public void handle(List<ConsumerRecord<String, String>> records) {
        List<FlashSaleEventPayload> reservedPayloads = new ArrayList<>(records.size());
        List<FlashSaleEventPayload> otherPayloads = new ArrayList<>();

        try {
            for (ConsumerRecord<String, String> record : records) {
                FlashSaleEventPayload payload = objectMapper.readValue(record.value(), FlashSaleEventPayload.class);
                if ("FLASH_SALE_RESERVED".equals(payload.eventType())) {
                    reservedPayloads.add(payload);
                } else {
                    otherPayloads.add(payload);
                }
            }
            syncService.syncReservedBatch(reservedPayloads);
            otherPayloads.forEach(syncService::sync);
            log.debug("Synced {} flash sale Kafka events: reservedBatch={}, others={}",
                    records.size(), reservedPayloads.size(), otherPayloads.size());
        } catch (Exception exception) {
            log.error("Failed to sync {} flash sale event(s) from Kafka", records.size(), exception);
            throw new IllegalStateException("Failed to sync flash sale reservation event", exception);
        }
    }
}
