package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.ShippingMethodEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ShippingMethodRepository extends JpaRepository<ShippingMethodEntity, Long> {

    List<ShippingMethodEntity> findByActiveTrueOrderByIdAsc();

    Optional<ShippingMethodEntity> findByIdAndActiveTrue(Long id);

    Optional<ShippingMethodEntity> findFirstByActiveTrueOrderByIdAsc();
}
