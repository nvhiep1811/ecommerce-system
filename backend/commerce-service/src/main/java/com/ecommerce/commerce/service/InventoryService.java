package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.InventoryItemEntity;
import com.ecommerce.commerce.domain.InventoryMovementEntity;
import com.ecommerce.commerce.domain.InventoryReservationEntity;
import com.ecommerce.commerce.dto.InventoryUpsertRequest;
import com.ecommerce.commerce.dto.OrderLineRequest;
import com.ecommerce.commerce.repository.InventoryItemRepository;
import com.ecommerce.commerce.repository.InventoryMovementRepository;
import com.ecommerce.commerce.repository.InventoryReservationRepository;
import com.ecommerce.shared.web.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class InventoryService {

    private final InventoryItemRepository inventoryItemRepository;
    private final InventoryReservationRepository inventoryReservationRepository;
    private final InventoryMovementRepository inventoryMovementRepository;

    public InventoryService(
            InventoryItemRepository inventoryItemRepository,
            InventoryReservationRepository inventoryReservationRepository,
            InventoryMovementRepository inventoryMovementRepository
    ) {
        this.inventoryItemRepository = inventoryItemRepository;
        this.inventoryReservationRepository = inventoryReservationRepository;
        this.inventoryMovementRepository = inventoryMovementRepository;
    }

    @Transactional
    public void upsertStock(InventoryUpsertRequest request) {
        InventoryItemEntity item = inventoryItemRepository.findByProductIdAndVariantIdIsNull(request.productId())
                .orElseGet(() -> {
                    InventoryItemEntity created = new InventoryItemEntity();
                    created.setProductId(request.productId());
                    created.setVariantId(null);
                    created.setReservedQty(0);
                    created.setSafetyStock(0);
                    return created;
                });

        item.setAvailableQty(request.stock());
        inventoryItemRepository.save(item);
    }

    @Transactional
    public void reserve(Long orderId, List<OrderLineRequest> items) {
        for (OrderLineRequest line : items) {
            InventoryItemEntity item = inventoryItemRepository.findByProductIdAndVariantIdIsNull(line.productId())
                    .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "Inventory not found for product " + line.productId()));

            if (item.getAvailableQty() < line.quantity()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Insufficient stock for product " + line.productId());
            }

            item.setAvailableQty(item.getAvailableQty() - line.quantity());
            item.setReservedQty(item.getReservedQty() + line.quantity());
            inventoryItemRepository.save(item);

            InventoryReservationEntity reservation = new InventoryReservationEntity();
            reservation.setOrderId(orderId);
            reservation.setProductId(line.productId());
            reservation.setVariantId(line.variantId());
            reservation.setQuantity(line.quantity());
            reservation.setStatus("reserved");
            reservation.setExpiresAt(OffsetDateTime.now().plusMinutes(30));
            reservation.setCreatedAt(OffsetDateTime.now());
            inventoryReservationRepository.save(reservation);

            createMovement(line.productId(), line.variantId(), "reserve", line.quantity(), "ORDER", String.valueOf(orderId), "Inventory reserved");
        }
    }

    @Transactional
    public void confirmReservations(Long orderId) {
        inventoryReservationRepository.findByOrderId(orderId).forEach(reservation -> {
            if (!"reserved".equalsIgnoreCase(reservation.getStatus())) {
                return;
            }
            InventoryItemEntity item = inventoryItemRepository.findByProductIdAndVariantIdIsNull(reservation.getProductId())
                    .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "Inventory not found for product " + reservation.getProductId()));

            item.setReservedQty(Math.max(0, item.getReservedQty() - reservation.getQuantity()));
            inventoryItemRepository.save(item);

            reservation.setStatus("confirmed");
            inventoryReservationRepository.save(reservation);
            createMovement(reservation.getProductId(), reservation.getVariantId(), "out", reservation.getQuantity(), "ORDER", String.valueOf(orderId), "Inventory confirmed");
        });
    }

    @Transactional
    public void releaseReservations(Long orderId) {
        inventoryReservationRepository.findByOrderId(orderId).forEach(reservation -> {
            if (!"reserved".equalsIgnoreCase(reservation.getStatus())) {
                return;
            }
            InventoryItemEntity item = inventoryItemRepository.findByProductIdAndVariantIdIsNull(reservation.getProductId())
                    .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "Inventory not found for product " + reservation.getProductId()));

            item.setReservedQty(Math.max(0, item.getReservedQty() - reservation.getQuantity()));
            item.setAvailableQty(item.getAvailableQty() + reservation.getQuantity());
            inventoryItemRepository.save(item);

            reservation.setStatus("released");
            inventoryReservationRepository.save(reservation);
            createMovement(reservation.getProductId(), reservation.getVariantId(), "release", reservation.getQuantity(), "ORDER", String.valueOf(orderId), "Inventory released");
        });
    }

    @Transactional
    public void cancelReservations(Long orderId) {
        inventoryReservationRepository.findByOrderId(orderId).forEach(reservation -> {
            if (!"reserved".equalsIgnoreCase(reservation.getStatus())
                    && !"confirmed".equalsIgnoreCase(reservation.getStatus())) {
                return;
            }
            InventoryItemEntity item = inventoryItemRepository.findByProductIdAndVariantIdIsNull(reservation.getProductId())
                    .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "Inventory not found for product " + reservation.getProductId()));

            if ("reserved".equalsIgnoreCase(reservation.getStatus())) {
                item.setReservedQty(Math.max(0, item.getReservedQty() - reservation.getQuantity()));
            }
            item.setAvailableQty(item.getAvailableQty() + reservation.getQuantity());
            inventoryItemRepository.save(item);

            reservation.setStatus("cancelled");
            inventoryReservationRepository.save(reservation);
            createMovement(reservation.getProductId(), reservation.getVariantId(), "cancel_restore", reservation.getQuantity(), "ORDER", String.valueOf(orderId), "Inventory restored after order cancellation");
        });
    }

    private void createMovement(Long productId, Long variantId, String movementType, Integer quantity, String referenceType, String referenceId, String note) {
        InventoryMovementEntity movement = new InventoryMovementEntity();
        movement.setProductId(productId);
        movement.setVariantId(variantId);
        movement.setMovementType(movementType);
        movement.setQuantity(quantity);
        movement.setReferenceType(referenceType);
        movement.setReferenceId(referenceId);
        movement.setNote(note);
        movement.setCreatedAt(OffsetDateTime.now());
        inventoryMovementRepository.save(movement);
    }
}
