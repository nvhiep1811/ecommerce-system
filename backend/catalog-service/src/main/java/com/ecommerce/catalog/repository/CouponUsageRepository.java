package com.ecommerce.catalog.repository;

import com.ecommerce.catalog.domain.CouponUsageEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CouponUsageRepository extends JpaRepository<CouponUsageEntity, Long> {
}
