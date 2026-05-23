package com.ecommerce.catalog.repository;

import com.ecommerce.catalog.domain.CouponEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<CouponEntity, Long> {

    List<CouponEntity> findByActiveTrueOrderByCreatedAtDesc();

    Optional<CouponEntity> findByCodeIgnoreCaseAndActiveTrue(String code);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update CouponEntity coupon
               set coupon.usedCount = coupon.usedCount + 1
             where coupon.id = :couponId
               and coupon.active = true
               and (coupon.usageLimit is null or coupon.usedCount < coupon.usageLimit)
            """)
    int consumeUsageSlot(@Param("couponId") Long couponId);
}
