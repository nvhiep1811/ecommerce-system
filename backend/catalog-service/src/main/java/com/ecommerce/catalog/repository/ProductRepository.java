package com.ecommerce.catalog.repository;

import com.ecommerce.catalog.domain.ProductEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<ProductEntity, Long> {

    List<ProductEntity> findByDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByCreatedAtDesc();

    List<ProductEntity> findByCategoryIdInAndDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByCreatedAtDesc(Collection<Long> categoryIds);

    List<ProductEntity> findByNameContainingIgnoreCaseAndDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByCreatedAtDesc(String search);

    List<ProductEntity> findTop10ByDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByRatingAvgDescCreatedAtDesc();

    Optional<ProductEntity> findByIdAndDeletedAtIsNull(Long id);

    List<ProductEntity> findBySellerIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID sellerId);

    List<ProductEntity> findByIdInAndDeletedAtIsNull(Collection<Long> ids);
}
