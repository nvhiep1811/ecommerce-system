package com.ecommerce.catalog.repository;

import com.ecommerce.catalog.domain.ProductEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<ProductEntity, Long>, JpaSpecificationExecutor<ProductEntity> {

    List<ProductEntity> findByDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByCreatedAtDesc();

    List<ProductEntity> findByCategoryIdInAndDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByCreatedAtDesc(Collection<Long> categoryIds);

    List<ProductEntity> findByNameContainingIgnoreCaseAndDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByCreatedAtDesc(String search);

    List<ProductEntity> findTop10ByDeletedAtIsNullAndActiveTrueAndPublishedTrueOrderByRatingAvgDescCreatedAtDesc();

    Optional<ProductEntity> findByIdAndDeletedAtIsNull(Long id);

    List<ProductEntity> findBySellerIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID sellerId);

    List<ProductEntity> findByIdInAndDeletedAtIsNull(Collection<Long> ids);

    @org.springframework.data.jpa.repository.Query(value =
        "SELECT * FROM products " +
        "WHERE deleted_at IS NULL AND active = true AND published = true " +
        "AND embedding IS NOT NULL " +
        "ORDER BY embedding <=> cast(:queryEmbedding as vector) " +
        "LIMIT :limit", nativeQuery = true)
    List<ProductEntity> searchSemantic(@org.springframework.data.repository.query.Param("queryEmbedding") String queryEmbedding, @org.springframework.data.repository.query.Param("limit") int limit);
}
