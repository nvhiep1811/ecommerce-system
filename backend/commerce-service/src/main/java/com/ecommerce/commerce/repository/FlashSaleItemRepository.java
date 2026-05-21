package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.FlashSaleItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FlashSaleItemRepository extends JpaRepository<FlashSaleItemEntity, Long> {

    Optional<FlashSaleItemEntity> findByIdAndCampaignId(Long id, Long campaignId);
}
