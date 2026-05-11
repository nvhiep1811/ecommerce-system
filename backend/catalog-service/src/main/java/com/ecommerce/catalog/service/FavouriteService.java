package com.ecommerce.catalog.service;

import com.ecommerce.catalog.domain.FavouriteEntity;
import com.ecommerce.catalog.domain.InventoryItemView;
import com.ecommerce.catalog.domain.ProductEntity;
import com.ecommerce.catalog.dto.FavouriteResponse;
import com.ecommerce.catalog.dto.FavouriteStatusResponse;
import com.ecommerce.catalog.dto.FavouritesResponse;
import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.repository.FavouriteRepository;
import com.ecommerce.catalog.repository.InventoryItemViewRepository;
import com.ecommerce.catalog.repository.ProductRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class FavouriteService {

    private final FavouriteRepository favouriteRepository;
    private final ProductRepository productRepository;
    private final InventoryItemViewRepository inventoryItemViewRepository;

    public FavouriteService(
            FavouriteRepository favouriteRepository,
            ProductRepository productRepository,
            InventoryItemViewRepository inventoryItemViewRepository
    ) {
        this.favouriteRepository = favouriteRepository;
        this.productRepository = productRepository;
        this.inventoryItemViewRepository = inventoryItemViewRepository;
    }

    public FavouritesResponse list(AuthenticatedUser principal) {
        UUID userId = UUID.fromString(principal.userId());
        var favourites = favouriteRepository.findByUserIdOrderByCreatedAtDesc(userId);
        var productIds = favourites.stream().map(FavouriteEntity::getProductId).toList();
        Map<Long, ProductEntity> productsById = productRepository.findByIdInAndDeletedAtIsNull(productIds)
                .stream()
                .collect(Collectors.toMap(ProductEntity::getId, Function.identity()));
        Map<Long, Integer> stockByProductId = inventoryItemViewRepository.findByProductIdInAndVariantIdIsNull(productIds)
                .stream()
                .collect(Collectors.toMap(InventoryItemView::getProductId, InventoryItemView::getAvailableQty));

        return new FavouritesResponse(favourites.stream()
                .map(favourite -> {
                    ProductEntity product = productsById.get(favourite.getProductId());
                    if (product == null) {
                        return null;
                    }
                    return new FavouriteResponse(
                            favourite.getId(),
                            toProductResponse(product, stockByProductId.getOrDefault(product.getId(), 0)),
                            favourite.getCreatedAt()
                    );
                })
                .filter(java.util.Objects::nonNull)
                .toList());
    }

    @Transactional
    public FavouriteResponse add(AuthenticatedUser principal, Long productId) {
        UUID userId = UUID.fromString(principal.userId());
        ProductEntity product = productRepository.findByIdAndDeletedAtIsNull(productId)
                .orElseThrow(() -> new EntityNotFoundException("Product not found"));

        FavouriteEntity favourite = favouriteRepository.findByUserIdAndProductId(userId, productId)
                .orElseGet(() -> {
                    FavouriteEntity next = new FavouriteEntity();
                    next.setUserId(userId);
                    next.setProductId(productId);
                    return next;
                });

        FavouriteEntity saved = favouriteRepository.save(favourite);
        int stock = inventoryItemViewRepository.findByProductIdAndVariantIdIsNull(productId)
                .map(InventoryItemView::getAvailableQty)
                .orElse(0);
        return new FavouriteResponse(saved.getId(), toProductResponse(product, stock), saved.getCreatedAt());
    }

    @Transactional
    public void remove(AuthenticatedUser principal, Long productId) {
        UUID userId = UUID.fromString(principal.userId());
        favouriteRepository.deleteByUserIdAndProductId(userId, productId);
    }

    public FavouriteStatusResponse status(AuthenticatedUser principal, Long productId) {
        UUID userId = UUID.fromString(principal.userId());
        return new FavouriteStatusResponse(productId, favouriteRepository.existsByUserIdAndProductId(userId, productId));
    }

    private ProductResponse toProductResponse(ProductEntity product, int stock) {
        return new ProductResponse(
                product.getId(),
                product.getCategoryId(),
                product.getName(),
                product.getDescription(),
                product.getThumbnailUrl(),
                product.getBasePrice(),
                stock,
                null,
                product.getRatingAvg(),
                product.getReviewCount(),
                null,
                product.getCreatedAt(),
                product.getSellerId(),
                null
        );
    }
}
