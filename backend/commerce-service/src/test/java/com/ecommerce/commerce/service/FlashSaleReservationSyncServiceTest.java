package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.FlashSaleItemEntity;
import com.ecommerce.commerce.domain.FlashSaleReservationEntity;
import com.ecommerce.commerce.repository.FlashSaleItemRepository;
import com.ecommerce.commerce.repository.FlashSaleReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlashSaleReservationSyncServiceTest {

    private final FlashSaleReservationRepository reservationRepository = mock(FlashSaleReservationRepository.class);
    private final FlashSaleItemRepository itemRepository = mock(FlashSaleItemRepository.class);
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private FlashSaleReservationSyncService syncService;

    @BeforeEach
    void setUp() {
        syncService = new FlashSaleReservationSyncService(reservationRepository, itemRepository, jdbcTemplate);
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

    @Test
    void syncReservedBatchShouldInsertReservationsAndRefreshItemCounts() {
        FlashSaleEventPayload payload1 = payload("event-1", "fsr-1", "req-1", 2);
        FlashSaleEventPayload payload2 = payload("event-2", "fsr-2", "req-2", 3);
        FlashSaleEventPayload duplicatePayload = payload("event-3", "fsr-dup", "req-dup", 5);
        when(jdbcTemplate.batchUpdate(anyString(), any(BatchPreparedStatementSetter.class)))
                .thenReturn(new int[]{1, 1, 0});

        syncService.syncReservedBatch(List.of(payload1, payload2, duplicatePayload));

        ArgumentCaptor<BatchPreparedStatementSetter> setterCaptor =
                ArgumentCaptor.forClass(BatchPreparedStatementSetter.class);
        verify(jdbcTemplate).batchUpdate(contains("flash_sale_reservations"), setterCaptor.capture());
        assertEquals(3, setterCaptor.getValue().getBatchSize());
        verify(jdbcTemplate).update(
                contains("select coalesce(sum(reservation.quantity), 0)::int"),
                eq(10L),
                eq(20L),
                eq(10L),
                eq(20L),
                eq(20L),
                eq(10L)
        );
    }

    @Test
    void resetProjectionShouldDeleteUnlinkedRowsAndRefreshCounts() {
        when(jdbcTemplate.update(contains("delete from public.flash_sale_reservations"), eq(10L), eq(20L)))
                .thenReturn(42);

        syncService.resetProjection(10L, 20L);

        verify(jdbcTemplate).update(contains("delete from public.flash_sale_reservations"), eq(10L), eq(20L));
        verify(jdbcTemplate).update(
                contains("select coalesce(sum(reservation.quantity), 0)::int"),
                eq(10L),
                eq(20L),
                eq(10L),
                eq(20L),
                eq(20L),
                eq(10L)
        );
    }

    @Test
    void syncShouldExpireExistingReservationAndRefreshItemCounts() {
        FlashSaleEventPayload payload = expiredPayload("event-3", "fsr-1", "req-1", 2);
        when(jdbcTemplate.update(contains("set status = ?"), eq("expired"), eq(payload.occurredAt()), eq("fsr-1")))
                .thenReturn(1);

        syncService.sync(payload);

        verify(jdbcTemplate).update(contains("set status = ?"), eq("expired"), eq(payload.occurredAt()), eq("fsr-1"));
        verify(jdbcTemplate).update(
                contains("select coalesce(sum(reservation.quantity), 0)::int"),
                eq(10L),
                eq(20L),
                eq(10L),
                eq(20L),
                eq(20L),
                eq(10L)
        );
        verify(reservationRepository, never()).findByReservationToken(any());
        verify(itemRepository, never()).save(any());
    }

    @Test
    void syncShouldInsertExpiredReservationWhenReleaseArrivesBeforeReservedEvent() {
        FlashSaleEventPayload payload = expiredPayload("event-4", "fsr-early", null, 1);
        when(jdbcTemplate.update(contains("set status = ?"), eq("expired"), eq(payload.occurredAt()), eq("fsr-early")))
                .thenReturn(0);
        when(jdbcTemplate.update(
                contains("insert into public.flash_sale_reservations"),
                eq(10L),
                eq(20L),
                eq(payload.userId()),
                eq("release-fsr-early"),
                eq("fsr-early"),
                eq(1),
                eq("expired"),
                eq(payload.expiresAt()),
                eq(payload.occurredAt())
        )).thenReturn(1);

        syncService.sync(payload);

        verify(jdbcTemplate).update(
                contains("insert into public.flash_sale_reservations"),
                eq(10L),
                eq(20L),
                eq(payload.userId()),
                eq("release-fsr-early"),
                eq("fsr-early"),
                eq(1),
                eq("expired"),
                eq(payload.expiresAt()),
                eq(payload.occurredAt())
        );
        verify(jdbcTemplate).update(
                contains("select coalesce(sum(reservation.quantity), 0)::int"),
                eq(10L),
                eq(20L),
                eq(10L),
                eq(20L),
                eq(20L),
                eq(10L)
        );
        verify(reservationRepository, never()).save(any());
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

    private FlashSaleEventPayload expiredPayload(String eventId, String token, String requestId, int quantity) {
        return new FlashSaleEventPayload(
                eventId,
                "FLASH_SALE_EXPIRED",
                OffsetDateTime.now(),
                10L,
                20L,
                UUID.randomUUID(),
                requestId,
                token,
                quantity,
                null,
                OffsetDateTime.now().minusSeconds(1)
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
