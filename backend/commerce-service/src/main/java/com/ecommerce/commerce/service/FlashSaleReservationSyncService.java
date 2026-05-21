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
    public void syncReserved(FlashSaleEventPayload payload) {
        if (!"FLASH_SALE_RESERVED".equals(payload.eventType())) {
            return;
        }

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
}
