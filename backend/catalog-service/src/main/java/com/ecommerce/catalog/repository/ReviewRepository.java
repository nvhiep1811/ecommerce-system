package com.ecommerce.catalog.repository;

import com.ecommerce.catalog.domain.ReviewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<ReviewEntity, Long> {

    List<ReviewEntity> findByProductIdAndStatusOrderByCreatedAtDesc(Long productId, String status);

    List<ReviewEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<ReviewEntity> findByUserIdAndOrderItemId(UUID userId, Long orderItemId);

    Optional<ReviewEntity> findByIdAndUserId(Long id, UUID userId);

    long countByProductIdAndStatus(Long productId, String status);

    @Query("select coalesce(avg(r.rating), 0) from ReviewEntity r where r.productId = :productId and r.status = :status")
    Double averageRating(@Param("productId") Long productId, @Param("status") String status);
}
