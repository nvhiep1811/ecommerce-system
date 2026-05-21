package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.FlashSaleItemEntity;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface FlashSaleItemRepository extends JpaRepository<FlashSaleItemEntity, Long> {

    Optional<FlashSaleItemEntity> findByIdAndCampaignId(Long id, Long campaignId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select item from FlashSaleItemEntity item where item.id = :id and item.campaignId = :campaignId")
    Optional<FlashSaleItemEntity> findByIdAndCampaignIdForUpdate(Long id, Long campaignId);
}
