package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.FlashSaleItemEntity;
import com.ecommerce.commerce.domain.FlashSaleReservationEntity;
import com.ecommerce.commerce.repository.FlashSaleItemRepository;
import com.ecommerce.commerce.repository.FlashSaleReservationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
public class FlashSaleReservationSyncService {

    private final FlashSaleReservationRepository reservationRepository;
    private final FlashSaleItemRepository itemRepository;

    public FlashSaleReservationSyncService(
            FlashSaleReservationRepository reservationRepository,
            FlashSaleItemRepository itemRepository
    ) {
        this.reservationRepository = reservationRepository;
        this.itemRepository = itemRepository;
    }

    @Transactional
    public void sync(FlashSaleEventPayload payload) {
        switch (payload.eventType()) {
            case "FLASH_SALE_RESERVED" -> handleReserved(payload);
            case "FLASH_SALE_EXPIRED", "FLASH_SALE_RELEASED" -> handleReleased(payload, "expired");
            default -> log.debug("Skip unsupported flash sale event type {}", payload.eventType());
        }
    }

    @Transactional
    public void syncReserved(FlashSaleEventPayload payload) {
        if (!"FLASH_SALE_RESERVED".equals(payload.eventType())) {
            return;
        }
        handleReserved(payload);
    }

    private void handleReserved(FlashSaleEventPayload payload) {
        if (reservationRepository.findByReservationToken(payload.reservationToken()).isPresent()
                || reservationRepository.findByCampaignIdAndItemIdAndUserIdAndRequestId(
                payload.campaignId(),
                payload.itemId(),
                payload.userId(),
                payload.requestId()
        ).isPresent()) {
            log.info("Skip duplicate flash sale reservation event {}", payload.eventId());
            return;
        }

        FlashSaleItemEntity item = itemRepository.findByIdAndCampaignId(payload.itemId(), payload.campaignId())
                .orElseThrow(() -> new IllegalStateException("Flash sale item not found for event " + payload.eventId()));

        FlashSaleReservationEntity reservation = new FlashSaleReservationEntity();
        reservation.setCampaignId(payload.campaignId());
        reservation.setItemId(payload.itemId());
        reservation.setUserId(payload.userId());
        reservation.setRequestId(payload.requestId());
        reservation.setReservationToken(payload.reservationToken());
        reservation.setQuantity(payload.quantity());
        reservation.setStatus("reserved");
        reservation.setExpiresAt(payload.expiresAt());
        reservationRepository.save(reservation);

        item.setReservedCount(item.getReservedCount() + payload.quantity());
        itemRepository.save(item);
    }

    private void handleReleased(FlashSaleEventPayload payload, String status) {
        if (payload.userId() == null || payload.reservationToken() == null || payload.quantity() == null) {
            log.warn("Skip invalid flash sale release event {}", payload.eventId());
            return;
        }

        FlashSaleItemEntity item = itemRepository.findByIdAndCampaignId(payload.itemId(), payload.campaignId())
                .orElseThrow(() -> new IllegalStateException("Flash sale item not found for event " + payload.eventId()));

        reservationRepository.findByReservationToken(payload.reservationToken())
                .ifPresentOrElse(
                        reservation -> releaseExistingReservation(payload, reservation, item, status),
                        () -> createReleasedReservation(payload, item, status)
                );
    }

    private void releaseExistingReservation(
            FlashSaleEventPayload payload,
            FlashSaleReservationEntity reservation,
            FlashSaleItemEntity item,
            String status
    ) {
        if (!"reserved".equalsIgnoreCase(reservation.getStatus())) {
            log.info("Skip duplicate flash sale release event {} for reservation {} with status {}",
                    payload.eventId(), reservation.getReservationToken(), reservation.getStatus());
            return;
        }

        reservation.setStatus(status);
        reservation.setReleasedAt(payload.occurredAt());
        reservationRepository.save(reservation);
        decrementReservedCount(item, payload.quantity());
    }

    private void createReleasedReservation(FlashSaleEventPayload payload, FlashSaleItemEntity item, String status) {
        FlashSaleReservationEntity reservation = new FlashSaleReservationEntity();
        reservation.setCampaignId(payload.campaignId());
        reservation.setItemId(payload.itemId());
        reservation.setUserId(payload.userId());
        reservation.setRequestId(payload.requestId() == null || payload.requestId().isBlank()
                ? "release-" + payload.reservationToken()
                : payload.requestId());
        reservation.setReservationToken(payload.reservationToken());
        reservation.setQuantity(payload.quantity());
        reservation.setStatus(status);
        reservation.setExpiresAt(payload.expiresAt() == null ? payload.occurredAt() : payload.expiresAt());
        reservation.setReleasedAt(payload.occurredAt());
        reservationRepository.save(reservation);
    }

    private void decrementReservedCount(FlashSaleItemEntity item, int quantity) {
        item.setReservedCount(Math.max(0, item.getReservedCount() - quantity));
        itemRepository.save(item);
    }
}
