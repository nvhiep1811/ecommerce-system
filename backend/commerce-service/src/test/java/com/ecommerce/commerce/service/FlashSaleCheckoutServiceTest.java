package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.FlashSaleItemEntity;
import com.ecommerce.commerce.domain.FlashSaleReservationEntity;
import com.ecommerce.commerce.dto.OrderLineRequest;
import com.ecommerce.commerce.repository.FlashSaleItemRepository;
import com.ecommerce.commerce.repository.FlashSaleReservationRepository;
import com.ecommerce.shared.web.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FlashSaleCheckoutServiceTest {

    private final FlashSaleItemRepository itemRepository = mock(FlashSaleItemRepository.class);
    private final FlashSaleReservationRepository reservationRepository = mock(FlashSaleReservationRepository.class);
    private final FlashSaleStockStore stockStore = mock(FlashSaleStockStore.class);
    private FlashSaleCheckoutService checkoutService;

    @BeforeEach
    void setUp() {
        checkoutService = new FlashSaleCheckoutService(itemRepository, reservationRepository, stockStore);
    }

    @Test
    void resolveForPricingShouldReturnSalePriceForValidFlashSaleLine() {
        UUID userId = UUID.randomUUID();
        OrderLineRequest line = new OrderLineRequest(100L, null, 1, 10L, 20L, "fsr-1");
        when(itemRepository.findByIdAndCampaignId(20L, 10L)).thenReturn(Optional.of(item()));
        when(reservationRepository.findByReservationToken("fsr-1")).thenReturn(Optional.empty());

        List<FlashSaleCheckoutReservation> reservations = checkoutService.resolveForPricing(userId, List.of(line));

        assertEquals(1, reservations.size());
        assertEquals("fsr-1", reservations.get(0).reservationToken());
        assertEquals(new BigDecimal("99000.00"), reservations.get(0).salePrice());
    }

    @Test
    void resolveForPricingShouldRejectReservationOwnedByAnotherUserWhenSynced() {
        UUID userId = UUID.randomUUID();
        OrderLineRequest line = new OrderLineRequest(100L, null, 1, 10L, 20L, "fsr-1");
        FlashSaleReservationEntity reservation = reservation(userId);
        reservation.setUserId(UUID.randomUUID());
        when(itemRepository.findByIdAndCampaignId(20L, 10L)).thenReturn(Optional.of(item()));
        when(reservationRepository.findByReservationToken("fsr-1")).thenReturn(Optional.of(reservation));

        assertThrows(BusinessException.class, () -> checkoutService.resolveForPricing(userId, List.of(line)));
    }

    @Test
    void confirmForOrderShouldConfirmRedisReservationAndUpdateCounters() {
        UUID userId = UUID.randomUUID();
        FlashSaleCheckoutReservation checkoutReservation = new FlashSaleCheckoutReservation(
                10L,
                20L,
                100L,
                null,
                "fsr-1",
                1,
                new BigDecimal("99000.00"),
                OffsetDateTime.now().plusMinutes(10)
        );
        FlashSaleItemEntity item = item();
        item.setReservedCount(2);
        item.setSoldCount(3);
        FlashSaleReservationEntity reservation = reservation(userId);
        when(stockStore.confirm(10L, 20L, "fsr-1", userId, 1))
                .thenReturn(new FlashSaleConfirmResult("CONFIRMED", "fsr-1", userId, "req-1", 1, OffsetDateTime.now().plusMinutes(10)));
        when(itemRepository.findByIdAndCampaignIdForUpdate(20L, 10L)).thenReturn(Optional.of(item));
        when(reservationRepository.findByReservationTokenForUpdate("fsr-1")).thenReturn(Optional.of(reservation));

        checkoutService.confirmForOrder(userId, 99L, List.of(checkoutReservation));

        assertEquals("confirmed", reservation.getStatus());
        assertEquals(99L, reservation.getOrderId());
        assertEquals(1, item.getReservedCount());
        assertEquals(4, item.getSoldCount());
        verify(reservationRepository).save(reservation);
        verify(itemRepository).save(item);
    }

    @Test
    void confirmForOrderShouldRejectExpiredRedisReservation() {
        UUID userId = UUID.randomUUID();
        FlashSaleCheckoutReservation checkoutReservation = new FlashSaleCheckoutReservation(
                10L,
                20L,
                100L,
                null,
                "fsr-1",
                1,
                new BigDecimal("99000.00"),
                OffsetDateTime.now().minusMinutes(1)
        );
        FlashSaleItemEntity item = item();
        item.setReservedCount(1);
        FlashSaleReservationEntity reservation = reservation(userId);
        BusinessException expected = new BusinessException(org.springframework.http.HttpStatus.CONFLICT, "Flash sale reservation has expired");
        when(stockStore.confirm(10L, 20L, "fsr-1", userId, 1))
                .thenReturn(new FlashSaleConfirmResult("EXPIRED", "fsr-1", userId, "req-1", 1, OffsetDateTime.now().minusMinutes(1)));
        when(itemRepository.findByIdAndCampaignIdForUpdate(20L, 10L)).thenReturn(Optional.of(item));
        when(reservationRepository.findByReservationTokenForUpdate("fsr-1")).thenReturn(Optional.of(reservation));

        BusinessException actual = assertThrows(
                BusinessException.class,
                () -> checkoutService.confirmForOrder(userId, 99L, List.of(checkoutReservation))
        );

        assertSame(expected.getStatus(), actual.getStatus());
        assertEquals("expired", reservation.getStatus());
        assertEquals(0, item.getReservedCount());
    }

    private FlashSaleItemEntity item() {
        FlashSaleItemEntity item = new FlashSaleItemEntity();
        item.setId(20L);
        item.setCampaignId(10L);
        item.setProductId(100L);
        item.setVariantId(null);
        item.setSalePrice(new BigDecimal("99000.00"));
        item.setStockLimit(100);
        item.setPerUserLimit(1);
        item.setReservedCount(0);
        item.setSoldCount(0);
        item.setStatus("active");
        return item;
    }

    private FlashSaleReservationEntity reservation(UUID userId) {
        FlashSaleReservationEntity reservation = new FlashSaleReservationEntity();
        reservation.setCampaignId(10L);
        reservation.setItemId(20L);
        reservation.setUserId(userId);
        reservation.setRequestId("req-1");
        reservation.setReservationToken("fsr-1");
        reservation.setQuantity(1);
        reservation.setStatus("reserved");
        reservation.setExpiresAt(OffsetDateTime.now().plusMinutes(10));
        return reservation;
    }
}
