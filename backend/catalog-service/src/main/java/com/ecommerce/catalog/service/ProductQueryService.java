package com.ecommerce.catalog.service;

import com.ecommerce.catalog.dto.ProductPageResponse;
import com.ecommerce.catalog.dto.ProductResponse;

import java.util.List;

/**
 * Read-only service for product queries.
 * Responsible for fetching product data — no writes, no cache eviction, no outbox.
 *
 * Cache layer: delegates to ProductPageReadCache before hitting ProductRepository.
 */
public interface ProductQueryService {

    /**
     * Get a paginated list of products with optional filters.
     * Uses ProductPageReadCache.
     */
    ProductPageResponse getProductsPage(int page, int size, String categoryId, String sellerId, String keyword);

    /**
     * Get a flat list of products matching keyword and/or category.
     */
    ProductPageResponse getProducts(String keyword, String categoryId, int page, int size);

    /**
     * Vector-based semantic search.
     */
    List<ProductResponse> searchSemantic(String query, int topK);

    /**
     * Get a single product by ID.
     */
    ProductResponse getProduct(Long productId);

    /**
     * Fetch product snapshots for a list of IDs (used by checkout).
     */
    List<ProductResponse> getProductSnapshots(List<Long> productIds);

    /**
     * Load stock map for a list of product IDs (used by checkout pricing).
     */
    java.util.Map<Long, Integer> loadStockMap(List<Long> productIds);

    /**
     * Load seller name map for a list of seller IDs (used by enrichment).
     */
    java.util.Map<Long, String> loadSellerNameMap(List<Long> sellerIds);
}
