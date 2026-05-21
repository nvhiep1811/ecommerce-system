package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.FlashSaleItemEntity;
import com.ecommerce.commerce.domain.FlashSaleReservationEntity;
import com.ecommerce.commerce.repository.FlashSaleItemRepository;
import com.ecommerce.commerce.repository.FlashSaleReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlashSaleReservationSyncServiceTest {

    private final FlashSaleReservationRepository reservationRepository = mock(FlashSaleReservationRepository.class);
    private final FlashSaleItemRepository itemRepository = mock(FlashSaleItemRepository.class);
    private FlashSaleReservationSyncService syncService;

    @BeforeEach
    void setUp() {
        syncService = new FlashSaleReservationSyncService(reservationRepository, itemRepository);
    }

    @Test
    void syncReservedShouldPersistReservationAndIncrementItemCount() {
        FlashSaleItemEntity item = item();
        FlashSaleEventPayload payload = payload("event-1", "fsr-1", "req-1", 2);
        when(reservationRepository.findByReservationToken("fsr-1")).thenReturn(Optional.empty());
        when(reservationRepository.findByCampaignIdAndItemIdAndUserIdAndRequestId(
                payload.campaignId(),
                payload.itemId(),
                payload.userId(),
                payload.requestId()
        )).thenReturn(Optional.empty());
        when(itemRepository.findByIdAndCampaignId(20L, 10L)).thenReturn(Optional.of(item));

        syncService.syncReserved(payload);

        verify(reservationRepository).save(any(FlashSaleReservationEntity.class));
        assertEquals(2, item.getReservedCount());
        verify(itemRepository).save(item);
    }

    @Test
    void syncReservedShouldSkipDuplicateReservationToken() {
        FlashSaleEventPayload payload = payload("event-1", "fsr-1", "req-1", 1);
        when(reservationRepository.findByReservationToken("fsr-1"))
                .thenReturn(Optional.of(new FlashSaleReservationEntity()));

        syncService.syncReserved(payload);

        verify(itemRepository, never()).findByIdAndCampaignId(any(), any());
        verify(reservationRepository, never()).save(any());
    }

    @Test
    void syncReservedShouldSkipUnsupportedEventType() {
        FlashSaleEventPayload payload = new FlashSaleEventPayload(
                "event-2",
                "FLASH_SALE_RELEASED",
                OffsetDateTime.now(),
                10L,
                20L,
                UUID.randomUUID(),
                "req-2",
                "fsr-2",
                1,
                99L,
                OffsetDateTime.now().plusMinutes(10)
        );

        syncService.syncReserved(payload);

        verify(reservationRepository, never()).findByReservationToken(any());
        verify(itemRepository, never()).findByIdAndCampaignId(any(), any());
    }

    private FlashSaleEventPayload payload(String eventId, String token, String requestId, int quantity) {
        return new FlashSaleEventPayload(
                eventId,
                "FLASH_SALE_RESERVED",
                OffsetDateTime.now(),
                10L,
                20L,
                UUID.randomUUID(),
                requestId,
                token,
                quantity,
                99L,
                OffsetDateTime.now().plusMinutes(10)
        );
    }

    private FlashSaleItemEntity item() {
        FlashSaleItemEntity item = new FlashSaleItemEntity();
        item.setId(20L);
        item.setCampaignId(10L);
        item.setProductId(100L);
        item.setSalePrice(new BigDecimal("99000.00"));
        item.setStockLimit(100);
        item.setPerUserLimit(1);
        item.setReservedCount(0);
        item.setSoldCount(0);
        item.setStatus("active");
        return item;
    }
}
