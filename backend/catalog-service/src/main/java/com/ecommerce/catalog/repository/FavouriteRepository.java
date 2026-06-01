package com.ecommerce.catalog.repository;

import com.ecommerce.catalog.domain.FavouriteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FavouriteRepository extends JpaRepository<FavouriteEntity, Long> {

    List<FavouriteEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<FavouriteEntity> findByUserIdAndProductId(UUID userId, Long productId);

    boolean existsByUserIdAndProductId(UUID userId, Long productId);

    void deleteByUserIdAndProductId(UUID userId, Long productId);
}
