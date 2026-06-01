package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.InventoryMovementEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovementEntity, Long> {
}
