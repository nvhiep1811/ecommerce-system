package com.ecommerce.commerce.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class FlashSaleReservationSyncServiceTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private FlashSaleReservationSyncService syncService;

    @BeforeEach
    void setUp() {
        syncService = new FlashSaleReservationSyncService(jdbcTemplate);
    }

    @Test
    void syncReservedShouldInsertReservationAndRefreshItemCounts() {
        FlashSaleEventPayload payload = payload("event-1", "fsr-1", "req-1", 2);
        when(jdbcTemplate.update(
                contains("insert into public.flash_sale_reservations"),
                eq(payload.campaignId()),
                eq(payload.itemId()),
                eq(payload.userId()),
                eq(payload.requestId()),
                eq(payload.reservationToken()),
                eq(payload.quantity()),
                eq(payload.expiresAt())
        )).thenReturn(1);

        syncService.syncReserved(payload);

        verifyItemLocked(10L, 20L);
        verify(jdbcTemplate).update(
                contains("insert into public.flash_sale_reservations"),
                eq(10L),
                eq(20L),
                eq(payload.userId()),
                eq("req-1"),
                eq("fsr-1"),
                eq(2),
                eq(payload.expiresAt())
        );
        verifyRefreshCounts();
    }

    @Test
    void syncReservedShouldRefreshCountsWhenDuplicateReservationToken() {
        FlashSaleEventPayload payload = payload("event-1", "fsr-1", "req-1", 1);
        when(jdbcTemplate.update(
                contains("insert into public.flash_sale_reservations"),
                eq(payload.campaignId()),
                eq(payload.itemId()),
                eq(payload.userId()),
                eq(payload.requestId()),
                eq(payload.reservationToken()),
                eq(payload.quantity()),
                eq(payload.expiresAt())
        )).thenReturn(0);

        syncService.syncReserved(payload);

        verifyItemLocked(10L, 20L);
        verifyRefreshCounts();
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

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void syncReservedBatchShouldInsertReservationsAndRefreshItemCounts() {
        FlashSaleEventPayload payload1 = payload("event-1", "fsr-1", "req-1", 2);
        FlashSaleEventPayload payload2 = payload("event-2", "fsr-2", "req-2", 3);
        FlashSaleEventPayload duplicatePayload = payload("event-3", "fsr-dup", "req-dup", 5);
        when(jdbcTemplate.batchUpdate(anyString(), any(BatchPreparedStatementSetter.class)))
                .thenReturn(new int[]{1, 1, 0});

        syncService.syncReservedBatch(List.of(payload1, payload2, duplicatePayload));

        verifyItemLocked(10L, 20L);
        ArgumentCaptor<BatchPreparedStatementSetter> setterCaptor =
                ArgumentCaptor.forClass(BatchPreparedStatementSetter.class);
        verify(jdbcTemplate).batchUpdate(contains("flash_sale_reservations"), setterCaptor.capture());
        assertEquals(3, setterCaptor.getValue().getBatchSize());
        verifyRefreshCounts();
    }

    @Test
    void resetProjectionShouldDeleteUnlinkedRowsAndRefreshCounts() {
        when(jdbcTemplate.update(contains("delete from public.flash_sale_reservations"), eq(10L), eq(20L)))
                .thenReturn(42);

        syncService.resetProjection(10L, 20L);

        verifyItemLocked(10L, 20L);
        verify(jdbcTemplate).update(contains("delete from public.flash_sale_reservations"), eq(10L), eq(20L));
        verifyRefreshCounts();
    }

    @Test
    void syncShouldExpireExistingReservationAndRefreshItemCounts() {
        FlashSaleEventPayload payload = expiredPayload("event-3", "fsr-1", "req-1", 2);
        when(jdbcTemplate.update(contains("set status = ?"), eq("expired"), eq(payload.occurredAt()), eq("fsr-1")))
                .thenReturn(1);

        syncService.sync(payload);

        verifyItemLocked(10L, 20L);
        verify(jdbcTemplate).update(contains("set status = ?"), eq("expired"), eq(payload.occurredAt()), eq("fsr-1"));
        verifyRefreshCounts();
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

        verifyItemLocked(10L, 20L);
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
        verifyRefreshCounts();
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

    private void verifyItemLocked(Long campaignId, Long itemId) {
        verify(jdbcTemplate).queryForObject(
                contains("pg_advisory_xact_lock"),
                eq(Long.class),
                eq("flash-sale-campaign:" + campaignId),
                eq("flash-sale-item:" + itemId)
        );
    }

    private void verifyRefreshCounts() {
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
}
