package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.FlashSaleReservationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface FlashSaleReservationRepository extends JpaRepository<FlashSaleReservationEntity, Long> {

    Optional<FlashSaleReservationEntity> findByReservationToken(String reservationToken);

    Optional<FlashSaleReservationEntity> findByCampaignIdAndItemIdAndUserIdAndRequestId(
            Long campaignId,
            Long itemId,
            UUID userId,
            String requestId
    );
}
