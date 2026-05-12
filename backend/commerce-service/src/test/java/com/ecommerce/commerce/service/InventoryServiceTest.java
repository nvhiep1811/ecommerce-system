package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.InventoryReservationEntity;
import com.ecommerce.commerce.dto.OrderLineRequest;
import com.ecommerce.commerce.repository.InventoryItemRepository;
import com.ecommerce.commerce.repository.InventoryMovementRepository;
import com.ecommerce.commerce.repository.InventoryReservationRepository;
import com.ecommerce.shared.web.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.time.OffsetDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class InventoryServiceTest {

    private final InventoryItemRepository inventoryItemRepository = mock(InventoryItemRepository.class);
    private final InventoryReservationRepository inventoryReservationRepository = mock(InventoryReservationRepository.class);
    private final InventoryMovementRepository inventoryMovementRepository = mock(InventoryMovementRepository.class);
    private InventoryService inventoryService;

    @BeforeEach
    void setUp() {
        inventoryService = new InventoryService(
                inventoryItemRepository,
                inventoryReservationRepository,
                inventoryMovementRepository
        );
    }

    @Test
    void reserveShouldUseAtomicConditionalUpdate() {
        when(inventoryItemRepository.reserveSimpleProduct(eq(100L), eq(2), any(OffsetDateTime.class)))
                .thenReturn(1);

        inventoryService.reserve(99L, List.of(new OrderLineRequest(100L, null, 2)));

        verify(inventoryItemRepository).reserveSimpleProduct(eq(100L), eq(2), any(OffsetDateTime.class));
        verify(inventoryReservationRepository).save(any(InventoryReservationEntity.class));
        verify(inventoryMovementRepository).save(any());
    }

    @Test
    void reserveShouldRejectWhenStockWasTakenByAnotherOrder() {
        when(inventoryItemRepository.reserveSimpleProduct(eq(100L), eq(1), any(OffsetDateTime.class)))
                .thenReturn(0);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> inventoryService.reserve(99L, List.of(new OrderLineRequest(100L, null, 1)))
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatus());
        assertEquals("Insufficient stock for product 100", exception.getMessage());
        verify(inventoryReservationRepository, never()).save(any());
        verify(inventoryMovementRepository, never()).save(any());
    }

    @Test
    void reserveShouldAggregateDuplicateProductLinesBeforeUpdatingInventory() {
        when(inventoryItemRepository.reserveSimpleProduct(eq(100L), eq(3), any(OffsetDateTime.class)))
                .thenReturn(1);

        inventoryService.reserve(99L, List.of(
                new OrderLineRequest(100L, null, 1),
                new OrderLineRequest(100L, null, 2)
        ));

        verify(inventoryItemRepository).reserveSimpleProduct(eq(100L), eq(3), any(OffsetDateTime.class));
        verify(inventoryReservationRepository).save(any(InventoryReservationEntity.class));
    }

    @Test
    void releaseReservationsShouldMoveReservedQtyBackToAvailableQty() {
        InventoryReservationEntity reservation = reservation(99L, 100L, 2);
        when(inventoryReservationRepository.findByOrderId(99L))
                .thenReturn(List.of(reservation));
        when(inventoryItemRepository.releaseSimpleReservation(eq(100L), eq(2), any(OffsetDateTime.class)))
                .thenReturn(1);

        inventoryService.releaseReservations(99L);

        assertEquals("released", reservation.getStatus());
        verify(inventoryItemRepository).releaseSimpleReservation(eq(100L), eq(2), any(OffsetDateTime.class));
        verify(inventoryReservationRepository).save(reservation);
        verify(inventoryMovementRepository).save(any());
    }

    @Test
    void confirmReservationsShouldOnlyClearReservedQty() {
        InventoryReservationEntity reservation = reservation(99L, 100L, 2);
        when(inventoryReservationRepository.findByOrderId(99L))
                .thenReturn(List.of(reservation));
        when(inventoryItemRepository.confirmSimpleReservation(eq(100L), eq(2), any(OffsetDateTime.class)))
                .thenReturn(1);

        inventoryService.confirmReservations(99L);

        assertEquals("confirmed", reservation.getStatus());
        verify(inventoryItemRepository).confirmSimpleReservation(eq(100L), eq(2), any(OffsetDateTime.class));
        verify(inventoryReservationRepository).save(reservation);
        verify(inventoryMovementRepository).save(any());
    }

    private InventoryReservationEntity reservation(Long orderId, Long productId, int quantity) {
        InventoryReservationEntity reservation = new InventoryReservationEntity();
        reservation.setOrderId(orderId);
        reservation.setProductId(productId);
        reservation.setQuantity(quantity);
        reservation.setStatus("reserved");
        return reservation;
    }
}
