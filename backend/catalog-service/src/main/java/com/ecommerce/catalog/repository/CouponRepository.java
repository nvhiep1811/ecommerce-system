package com.ecommerce.catalog.repository;

import com.ecommerce.catalog.domain.CouponEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<CouponEntity, Long> {

    List<CouponEntity> findByActiveTrueOrderByCreatedAtDesc();

    Optional<CouponEntity> findByCodeIgnoreCaseAndActiveTrue(String code);
}
