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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
        OffsetDateTime now = OffsetDateTime.now();
        for (InventoryLine line : aggregateLines(items)) {
            int updated = line.variantId() == null
                    ? inventoryItemRepository.reserveSimpleProduct(line.productId(), line.quantity(), now)
                    : inventoryItemRepository.reserveVariantProduct(line.productId(), line.variantId(), line.quantity(), now);

            if (updated != 1) {
                throw new BusinessException(
                        HttpStatus.CONFLICT,
                        "Insufficient stock for product " + line.productId()
                );
            }

            InventoryReservationEntity reservation = new InventoryReservationEntity();
            reservation.setOrderId(orderId);
            reservation.setProductId(line.productId());
            reservation.setVariantId(line.variantId());
            reservation.setQuantity(line.quantity());
            reservation.setStatus("reserved");
            reservation.setExpiresAt(now.plusMinutes(30));
            reservation.setCreatedAt(now);
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

            int updated = reservation.getVariantId() == null
                    ? inventoryItemRepository.confirmSimpleReservation(reservation.getProductId(), reservation.getQuantity(), OffsetDateTime.now())
                    : inventoryItemRepository.confirmVariantReservation(reservation.getProductId(), reservation.getVariantId(), reservation.getQuantity(), OffsetDateTime.now());
            if (updated != 1) {
                throw new BusinessException(HttpStatus.CONFLICT, "Inventory reservation cannot be confirmed for product " + reservation.getProductId());
            }

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

            int updated = reservation.getVariantId() == null
                    ? inventoryItemRepository.releaseSimpleReservation(reservation.getProductId(), reservation.getQuantity(), OffsetDateTime.now())
                    : inventoryItemRepository.releaseVariantReservation(reservation.getProductId(), reservation.getVariantId(), reservation.getQuantity(), OffsetDateTime.now());
            if (updated != 1) {
                throw new BusinessException(HttpStatus.CONFLICT, "Inventory reservation cannot be released for product " + reservation.getProductId());
            }

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

            int updated;
            if ("reserved".equalsIgnoreCase(reservation.getStatus())) {
                updated = reservation.getVariantId() == null
                        ? inventoryItemRepository.releaseSimpleReservation(reservation.getProductId(), reservation.getQuantity(), OffsetDateTime.now())
                        : inventoryItemRepository.releaseVariantReservation(reservation.getProductId(), reservation.getVariantId(), reservation.getQuantity(), OffsetDateTime.now());
            } else {
                updated = reservation.getVariantId() == null
                        ? inventoryItemRepository.restoreSimpleConfirmedReservation(reservation.getProductId(), reservation.getQuantity(), OffsetDateTime.now())
                        : inventoryItemRepository.restoreVariantConfirmedReservation(reservation.getProductId(), reservation.getVariantId(), reservation.getQuantity(), OffsetDateTime.now());
            }
            if (updated != 1) {
                throw new BusinessException(HttpStatus.CONFLICT, "Inventory reservation cannot be restored for product " + reservation.getProductId());
            }

            reservation.setStatus("released");
            inventoryReservationRepository.save(reservation);
            createMovement(reservation.getProductId(), reservation.getVariantId(), "release", reservation.getQuantity(), "ORDER", String.valueOf(orderId), "Inventory restored after order cancellation");
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

    private List<InventoryLine> aggregateLines(List<OrderLineRequest> items) {
        Map<String, InventoryLine> aggregated = new LinkedHashMap<>();
        for (OrderLineRequest item : items) {
            String key = item.productId() + ":" + (item.variantId() == null ? "" : item.variantId());
            InventoryLine existing = aggregated.get(key);
            if (existing == null) {
                aggregated.put(key, new InventoryLine(item.productId(), item.variantId(), item.quantity()));
                continue;
            }
            aggregated.put(key, new InventoryLine(item.productId(), item.variantId(), existing.quantity() + item.quantity()));
        }

        return aggregated.values().stream()
                .sorted(Comparator.comparing(InventoryLine::productId)
                        .thenComparing(line -> line.variantId() == null ? Long.MIN_VALUE : line.variantId()))
                .toList();
    }

    private record InventoryLine(Long productId, Long variantId, Integer quantity) {
    }
}
