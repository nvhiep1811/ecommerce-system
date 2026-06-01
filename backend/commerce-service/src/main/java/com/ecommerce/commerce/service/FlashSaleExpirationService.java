package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.FlashSaleProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
public class FlashSaleExpirationService {

    private final FlashSaleProperties properties;
    private final FlashSaleStockStore stockStore;
    private final FlashSaleEventPublisher eventPublisher;

    public FlashSaleExpirationService(
            FlashSaleProperties properties,
            FlashSaleStockStore stockStore,
            FlashSaleEventPublisher eventPublisher
    ) {
        this.properties = properties;
        this.stockStore = stockStore;
        this.eventPublisher = eventPublisher;
    }

    @Scheduled(fixedDelayString = "${flash-sale.expiration-scan-delay-ms:5000}")
    public void expireReservations() {
        if (!properties.isEnabled()) {
            return;
        }

        int batchSize = Math.max(1, properties.getExpirationBatchSize());
        long nowEpochSeconds = Instant.now().getEpochSecond();
        for (FlashSaleActiveItem item : stockStore.activeItems()) {
            expireItemReservations(item, nowEpochSeconds, batchSize);
        }
    }

    private void expireItemReservations(FlashSaleActiveItem item, long nowEpochSeconds, int batchSize) {
        List<String> tokens = stockStore.expiredReservationTokens(
                item.campaignId(),
                item.itemId(),
                nowEpochSeconds,
                batchSize
        );

        for (String token : tokens) {
            try {
                FlashSaleReleaseResult result = stockStore.release(item.campaignId(), item.itemId(), token);
                if (!result.released()) {
                    log.debug("Skip flash sale release token {} with status {}", token, result.status());
                    continue;
                }
                eventPublisher.publishReservationExpired(toExpiredPayload(item, result));
            } catch (RuntimeException exception) {
                log.error("Failed to expire flash sale reservation {} for campaign {} item {}",
                        token, item.campaignId(), item.itemId(), exception);
            }
        }
    }

    private FlashSaleEventPayload toExpiredPayload(FlashSaleActiveItem item, FlashSaleReleaseResult result) {
        return new FlashSaleEventPayload(
                UUID.randomUUID().toString(),
                "FLASH_SALE_EXPIRED",
                OffsetDateTime.now(),
                item.campaignId(),
                item.itemId(),
                result.userId(),
                result.requestId(),
                result.reservationToken(),
                result.quantity(),
                null,
                result.expiresAt()
        );
    }
}