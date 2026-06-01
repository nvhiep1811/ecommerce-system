package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.FlashSaleProperties;
import com.ecommerce.commerce.domain.FlashSaleItemEntity;
import com.ecommerce.commerce.dto.FlashSaleClaimRequest;
import com.ecommerce.commerce.dto.FlashSaleClaimResponse;
import com.ecommerce.commerce.dto.FlashSalePreloadRequest;
import com.ecommerce.commerce.dto.FlashSalePreloadResponse;
import com.ecommerce.commerce.repository.FlashSaleItemRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FlashSaleServiceTest {

    @Mock
    private FlashSaleStockStore stockStore;

    @Mock
    private FlashSaleEventPublisher eventPublisher;

    @Mock
    private FlashSaleItemRepository flashSaleItemRepository;

    @Mock
    private FlashSaleReservationSyncService reservationSyncService;

    private FlashSaleProperties properties;
    private FlashSaleService flashSaleService;

    @BeforeEach
    void setUp() {
        properties = new FlashSaleProperties();
        properties.setEnabled(true);
        properties.setReservationTtlSeconds(600);
        properties.getEvents().setKafkaEnabled(true);
        flashSaleService = new FlashSaleService(properties, stockStore, eventPublisher, flashSaleItemRepository, reservationSyncService);
    }

    @Test
    void preloadShouldUseItemDefaultsWhenRequestOmitsValues() {
        when(flashSaleItemRepository.findByIdAndCampaignId(20L, 10L))
                .thenReturn(Optional.of(item("active", 500, 2)));

        FlashSalePreloadResponse response = flashSaleService.preload(
                admin(),
                10L,
                20L,
                new FlashSalePreloadRequest(null, null, null)
        );

        assertEquals("PRELOADED", response.status());
        assertEquals(500, response.stock());
        assertEquals(2, response.perUserLimit());
        verify(stockStore).preload(10L, 20L, 500, 2);
        verifyNoInteractions(reservationSyncService);
    }

    @Test
    void preloadShouldResetProjectionWhenTestOpsEnabled() {
        properties.setTestOpsEnabled(true);
        when(flashSaleItemRepository.findByIdAndCampaignId(20L, 10L))
                .thenReturn(Optional.of(item("active", 500, 2)));

        flashSaleService.preload(
                admin(),
                10L,
                20L,
                new FlashSalePreloadRequest(200, 1, true)
        );

        verify(reservationSyncService).resetProjection(10L, 20L);
        verify(stockStore).preload(10L, 20L, 200, 1);
    }

    @Test
    void preloadShouldRejectProjectionResetWhenTestOpsDisabled() {
        when(flashSaleItemRepository.findByIdAndCampaignId(20L, 10L))
                .thenReturn(Optional.of(item("active", 500, 2)));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> flashSaleService.preload(admin(), 10L, 20L, new FlashSalePreloadRequest(200, 1, true))
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        verify(stockStore, never()).preload(any(), any(), any(), any());
        verifyNoInteractions(reservationSyncService);
    }

    @Test
    void claimShouldReserveAndPublishFlashSaleEvent() {
        UUID userId = UUID.randomUUID();
        OffsetDateTime expiresAt = OffsetDateTime.now().plusMinutes(10);
        when(stockStore.claim(any(FlashSaleClaimCommand.class), eq(600L)))
                .thenReturn(new FlashSaleClaimResult("RESERVED", "fsr-token", 1, 99L, expiresAt));

        FlashSaleClaimResponse response = flashSaleService.claim(
                customer(userId),
                10L,
                20L,
                new FlashSaleClaimRequest("req-1", 1)
        );

        assertEquals("RESERVED", response.status());
        assertEquals("fsr-token", response.reservationToken());
        assertEquals(99L, response.remainingStock());

        ArgumentCaptor<FlashSaleEventPayload> payloadCaptor = ArgumentCaptor.forClass(FlashSaleEventPayload.class);
        verify(eventPublisher).publishReservationClaimed(payloadCaptor.capture());
        FlashSaleEventPayload payload = payloadCaptor.getValue();
        assertNotNull(payload.eventId());
        assertEquals("FLASH_SALE_RESERVED", payload.eventType());
        assertEquals(userId, payload.userId());
        assertEquals("req-1", payload.requestId());
        assertEquals("fsr-token", payload.reservationToken());
    }

    @Test
    void duplicateClaimShouldReturnExistingReservationWithoutRepublishingEvent() {
        UUID userId = UUID.randomUUID();
        OffsetDateTime expiresAt = OffsetDateTime.now().plusMinutes(10);
        when(stockStore.claim(any(FlashSaleClaimCommand.class), eq(600L)))
                .thenReturn(new FlashSaleClaimResult("DUPLICATE", "fsr-token", 1, 98L, expiresAt));

        FlashSaleClaimResponse response = flashSaleService.claim(
                customer(userId),
                10L,
                20L,
                new FlashSaleClaimRequest("req-1", 1)
        );

        assertEquals("RESERVED", response.status());
        assertEquals("fsr-token", response.reservationToken());
        verify(eventPublisher, never()).publishReservationClaimed(any());
    }

    @Test
    void claimShouldReleaseRedisReservationWhenKafkaPublishFails() {
        UUID userId = UUID.randomUUID();
        when(stockStore.claim(any(FlashSaleClaimCommand.class), eq(600L)))
                .thenReturn(new FlashSaleClaimResult("RESERVED", "fsr-token", 1, 99L, OffsetDateTime.now().plusMinutes(10)));
        doThrow(new IllegalStateException("kafka down"))
                .when(eventPublisher).publishReservationClaimed(any());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> flashSaleService.claim(customer(userId), 10L, 20L, new FlashSaleClaimRequest("req-1", 1))
        );

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatus());
        verify(stockStore).release(10L, 20L, "fsr-token");
    }

    @Test
    void claimShouldRejectSoldOutWithoutPublishingEvent() {
        UUID userId = UUID.randomUUID();
        when(stockStore.claim(any(FlashSaleClaimCommand.class), eq(600L)))
                .thenReturn(new FlashSaleClaimResult("SOLD_OUT", null, 1, 0L, null));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> flashSaleService.claim(customer(userId), 10L, 20L, new FlashSaleClaimRequest("req-1", 1))
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatus());
        verify(eventPublisher, never()).publishReservationClaimed(any());
    }

    private FlashSaleItemEntity item(String status, int stockLimit, int perUserLimit) {
        FlashSaleItemEntity item = new FlashSaleItemEntity();
        item.setId(20L);
        item.setCampaignId(10L);
        item.setProductId(100L);
        item.setSalePrice(new BigDecimal("99000.00"));
        item.setStockLimit(stockLimit);
        item.setPerUserLimit(perUserLimit);
        item.setReservedCount(0);
        item.setSoldCount(0);
        item.setStatus(status);
        return item;
    }

    private AuthenticatedUser admin() {
        return new AuthenticatedUser(UUID.randomUUID().toString(), "admin@example.com", List.of("ADMIN"));
    }

    private AuthenticatedUser customer(UUID userId) {
        return new AuthenticatedUser(userId.toString(), "buyer@example.com", List.of("CUSTOMER"));
    }
}
