package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.InventoryReservationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryReservationRepository extends JpaRepository<InventoryReservationEntity, Long> {

    List<InventoryReservationEntity> findByOrderId(Long orderId);
}
