package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.FlashSaleReservationEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FlashSaleReservationRepository extends JpaRepository<FlashSaleReservationEntity, Long> {

    Optional<FlashSaleReservationEntity> findByReservationToken(String reservationToken);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select reservation from FlashSaleReservationEntity reservation where reservation.reservationToken = :reservationToken")
    Optional<FlashSaleReservationEntity> findByReservationTokenForUpdate(String reservationToken);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select reservation from FlashSaleReservationEntity reservation where reservation.orderId = :orderId")
    List<FlashSaleReservationEntity> findByOrderIdForUpdate(Long orderId);

    Optional<FlashSaleReservationEntity> findByCampaignIdAndItemIdAndUserIdAndRequestId(
            Long campaignId,
            Long itemId,
            UUID userId,
            String requestId
    );
}
