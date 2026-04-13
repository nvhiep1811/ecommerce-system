package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.InventoryItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface InventoryItemRepository extends JpaRepository<InventoryItemEntity, Long> {

    Optional<InventoryItemEntity> findByProductIdAndVariantIdIsNull(Long productId);
}
