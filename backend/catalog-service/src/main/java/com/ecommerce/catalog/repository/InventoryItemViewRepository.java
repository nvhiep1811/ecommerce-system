package com.ecommerce.catalog.repository;

import com.ecommerce.catalog.domain.InventoryItemView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface InventoryItemViewRepository extends JpaRepository<InventoryItemView, Long> {

    Optional<InventoryItemView> findByProductIdAndVariantIdIsNull(Long productId);

    List<InventoryItemView> findByProductIdInAndVariantIdIsNull(Collection<Long> productIds);
}
