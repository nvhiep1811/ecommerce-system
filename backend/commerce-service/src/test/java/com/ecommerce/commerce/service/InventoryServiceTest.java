package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.InventoryItemEntity;
import com.ecommerce.commerce.domain.InventoryReservationEntity;
import com.ecommerce.commerce.dto.OrderLineRequest;
import com.ecommerce.commerce.repository.InventoryItemRepository;
import com.ecommerce.commerce.repository.InventoryMovementRepository;
import com.ecommerce.commerce.repository.InventoryReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
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
    void reserveShouldMoveAvailableQtyToReservedQty() {
        InventoryItemEntity item = item(10, 1);
        when(inventoryItemRepository.findByProductIdAndVariantIdIsNull(100L))
                .thenReturn(Optional.of(item));

        inventoryService.reserve(99L, List.of(new OrderLineRequest(100L, null, 2)));

        assertEquals(8, item.getAvailableQty());
        assertEquals(3, item.getReservedQty());
        verify(inventoryItemRepository).save(item);
        verify(inventoryReservationRepository).save(any(InventoryReservationEntity.class));
        verify(inventoryMovementRepository).save(any());
    }

    @Test
    void releaseReservationsShouldMoveReservedQtyBackToAvailableQty() {
        InventoryItemEntity item = item(8, 2);
        InventoryReservationEntity reservation = reservation(99L, 100L, 2);
        when(inventoryReservationRepository.findByOrderId(99L))
                .thenReturn(List.of(reservation));
        when(inventoryItemRepository.findByProductIdAndVariantIdIsNull(100L))
                .thenReturn(Optional.of(item));

        inventoryService.releaseReservations(99L);

        assertEquals(10, item.getAvailableQty());
        assertEquals(0, item.getReservedQty());
        assertEquals("released", reservation.getStatus());
        verify(inventoryItemRepository).save(item);
        verify(inventoryReservationRepository).save(reservation);
        verify(inventoryMovementRepository).save(any());
    }

    @Test
    void confirmReservationsShouldOnlyClearReservedQty() {
        InventoryItemEntity item = item(8, 2);
        InventoryReservationEntity reservation = reservation(99L, 100L, 2);
        when(inventoryReservationRepository.findByOrderId(99L))
                .thenReturn(List.of(reservation));
        when(inventoryItemRepository.findByProductIdAndVariantIdIsNull(100L))
                .thenReturn(Optional.of(item));

        inventoryService.confirmReservations(99L);

        assertEquals(8, item.getAvailableQty());
        assertEquals(0, item.getReservedQty());
        assertEquals("confirmed", reservation.getStatus());
        verify(inventoryItemRepository).save(item);
        verify(inventoryReservationRepository).save(reservation);
        verify(inventoryMovementRepository).save(any());
    }

    private InventoryItemEntity item(int availableQty, int reservedQty) {
        InventoryItemEntity item = new InventoryItemEntity();
        item.setProductId(100L);
        item.setVariantId(null);
        item.setAvailableQty(availableQty);
        item.setReservedQty(reservedQty);
        item.setSafetyStock(0);
        return item;
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
