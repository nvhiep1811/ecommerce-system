package com.ecommerce.commerce.repository;

import com.ecommerce.commerce.domain.InventoryItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface InventoryItemRepository extends JpaRepository<InventoryItemEntity, Long> {

    Optional<InventoryItemEntity> findByProductIdAndVariantIdIsNull(Long productId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update InventoryItemEntity item
               set item.availableQty = item.availableQty - :quantity,
                   item.reservedQty = item.reservedQty + :quantity,
                   item.version = item.version + 1,
                   item.updatedAt = :updatedAt
             where item.productId = :productId
               and item.variantId is null
               and item.availableQty >= :quantity
            """)
    int reserveSimpleProduct(
            @Param("productId") Long productId,
            @Param("quantity") Integer quantity,
            @Param("updatedAt") OffsetDateTime updatedAt
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update InventoryItemEntity item
               set item.availableQty = item.availableQty - :quantity,
                   item.reservedQty = item.reservedQty + :quantity,
                   item.version = item.version + 1,
                   item.updatedAt = :updatedAt
             where item.productId = :productId
               and item.variantId = :variantId
               and item.availableQty >= :quantity
            """)
    int reserveVariantProduct(
            @Param("productId") Long productId,
            @Param("variantId") Long variantId,
            @Param("quantity") Integer quantity,
            @Param("updatedAt") OffsetDateTime updatedAt
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update InventoryItemEntity item
               set item.reservedQty = item.reservedQty - :quantity,
                   item.version = item.version + 1,
                   item.updatedAt = :updatedAt
             where item.productId = :productId
               and item.variantId is null
               and item.reservedQty >= :quantity
            """)
    int confirmSimpleReservation(
            @Param("productId") Long productId,
            @Param("quantity") Integer quantity,
            @Param("updatedAt") OffsetDateTime updatedAt
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update InventoryItemEntity item
               set item.reservedQty = item.reservedQty - :quantity,
                   item.version = item.version + 1,
                   item.updatedAt = :updatedAt
             where item.productId = :productId
               and item.variantId = :variantId
               and item.reservedQty >= :quantity
            """)
    int confirmVariantReservation(
            @Param("productId") Long productId,
            @Param("variantId") Long variantId,
            @Param("quantity") Integer quantity,
            @Param("updatedAt") OffsetDateTime updatedAt
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update InventoryItemEntity item
               set item.availableQty = item.availableQty + :quantity,
                   item.reservedQty = item.reservedQty - :quantity,
                   item.version = item.version + 1,
                   item.updatedAt = :updatedAt
             where item.productId = :productId
               and item.variantId is null
               and item.reservedQty >= :quantity
            """)
    int releaseSimpleReservation(
            @Param("productId") Long productId,
            @Param("quantity") Integer quantity,
            @Param("updatedAt") OffsetDateTime updatedAt
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update InventoryItemEntity item
               set item.availableQty = item.availableQty + :quantity,
                   item.reservedQty = item.reservedQty - :quantity,
                   item.version = item.version + 1,
                   item.updatedAt = :updatedAt
             where item.productId = :productId
               and item.variantId = :variantId
               and item.reservedQty >= :quantity
            """)
    int releaseVariantReservation(
            @Param("productId") Long productId,
            @Param("variantId") Long variantId,
            @Param("quantity") Integer quantity,
            @Param("updatedAt") OffsetDateTime updatedAt
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update InventoryItemEntity item
               set item.availableQty = item.availableQty + :quantity,
                   item.version = item.version + 1,
                   item.updatedAt = :updatedAt
             where item.productId = :productId
               and item.variantId is null
            """)
    int restoreSimpleConfirmedReservation(
            @Param("productId") Long productId,
            @Param("quantity") Integer quantity,
            @Param("updatedAt") OffsetDateTime updatedAt
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update InventoryItemEntity item
               set item.availableQty = item.availableQty + :quantity,
                   item.version = item.version + 1,
                   item.updatedAt = :updatedAt
             where item.productId = :productId
               and item.variantId = :variantId
            """)
    int restoreVariantConfirmedReservation(
            @Param("productId") Long productId,
            @Param("variantId") Long variantId,
            @Param("quantity") Integer quantity,
            @Param("updatedAt") OffsetDateTime updatedAt
    );
}
