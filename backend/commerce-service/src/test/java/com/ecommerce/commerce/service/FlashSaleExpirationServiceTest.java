package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.FlashSaleProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlashSaleExpirationServiceTest {

    private final FlashSaleStockStore stockStore = mock(FlashSaleStockStore.class);
    private final FlashSaleEventPublisher eventPublisher = mock(FlashSaleEventPublisher.class);
    private FlashSaleProperties properties;
    private FlashSaleExpirationService expirationService;

    @BeforeEach
    void setUp() {
        properties = new FlashSaleProperties();
        properties.setEnabled(true);
        properties.setExpirationBatchSize(50);
        expirationService = new FlashSaleExpirationService(properties, stockStore, eventPublisher);
    }

    @Test
    void expireReservationsShouldReleaseExpiredTokensAndPublishExpiredEvent() {
        UUID userId = UUID.randomUUID();
        OffsetDateTime expiresAt = OffsetDateTime.now().minusSeconds(1);
        when(stockStore.activeItems()).thenReturn(List.of(new FlashSaleActiveItem(10L, 20L)));
        when(stockStore.expiredReservationTokens(eq(10L), eq(20L), anyLong(), eq(50)))
                .thenReturn(List.of("fsr-1"));
        when(stockStore.release(10L, 20L, "fsr-1"))
                .thenReturn(new FlashSaleReleaseResult("RELEASED", "fsr-1", userId, "req-1", 1, expiresAt));

        expirationService.expireReservations();

        ArgumentCaptor<FlashSaleEventPayload> payloadCaptor = ArgumentCaptor.forClass(FlashSaleEventPayload.class);
        verify(eventPublisher).publishReservationExpired(payloadCaptor.capture());
        FlashSaleEventPayload payload = payloadCaptor.getValue();
        assertEquals("FLASH_SALE_EXPIRED", payload.eventType());
        assertEquals(10L, payload.campaignId());
        assertEquals(20L, payload.itemId());
        assertEquals(userId, payload.userId());
        assertEquals("req-1", payload.requestId());
        assertEquals("fsr-1", payload.reservationToken());
        assertEquals(1, payload.quantity());
        assertEquals(expiresAt, payload.expiresAt());
    }

    @Test
    void expireReservationsShouldDoNothingWhenDisabled() {
        properties.setEnabled(false);

        expirationService.expireReservations();

        verify(stockStore, never()).activeItems();
        verify(eventPublisher, never()).publishReservationExpired(org.mockito.ArgumentMatchers.any());
    }
}
