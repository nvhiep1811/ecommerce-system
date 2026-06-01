package com.ecommerce.catalog.service.impl;

import com.ecommerce.catalog.dto.ProductPageResponse;
import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.service.CatalogService;
import com.ecommerce.catalog.service.ProductQueryService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ProductQueryServiceImpl implements ProductQueryService {

    private final CatalogService catalogService;

    public ProductQueryServiceImpl(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @Override
    public ProductPageResponse getProductsPage(int page, int size, String categoryId, String sellerId, String keyword) {
        Long categoryIdLong = categoryId != null ? Long.parseLong(categoryId) : null;
        UUID sellerIdUuid = sellerId != null ? UUID.fromString(sellerId) : null;
        return catalogService.getProductsPage(categoryIdLong, sellerIdUuid, keyword, false, page, size, null, null);
    }

    @Override
    public ProductPageResponse getProducts(String keyword, String categoryId, int page, int size) {
        Long categoryIdLong = categoryId != null ? Long.parseLong(categoryId) : null;
        // getProducts in CatalogService returns a flat list — wrap into a page manually
        List<ProductResponse> items = catalogService.getProducts(categoryIdLong, null, keyword, false);
        int fromIndex = Math.min(page * size, items.size());
        int toIndex = Math.min(fromIndex + size, items.size());
        List<ProductResponse> paged = items.subList(fromIndex, toIndex);
        int totalPages = (int) Math.ceil((double) items.size() / size);
        return new ProductPageResponse(paged, page, size, items.size(), totalPages, toIndex < items.size());
    }

    @Override
    public List<ProductResponse> searchSemantic(String query, int topK) {
        return catalogService.searchSemantic(query, topK);
    }

    @Override
    public ProductResponse getProduct(Long productId) {
        return catalogService.getProduct(productId);
    }

    @Override
    public List<ProductResponse> getProductSnapshots(List<Long> productIds) {
        // Reuse snapshot logic — map to ProductResponse for interface contract
        return catalogService.getProductSnapshots(productIds).stream()
                .map(snap -> new ProductResponse(
                        snap.productId(),
                        null,
                        snap.name(),
                        null,
                        snap.thumbnailUrl(),
                        snap.price(),
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        snap.sellerId(),
                        null,
                        List.of()
                ))
                .toList();
    }

    @Override
    public Map<Long, Integer> loadStockMap(List<Long> productIds) {
        // Exposed via package-private helper in CatalogService — call getProductsPage
        // which internally uses loadStockMap. For direct access, use getProduct per ID.
        // This is a best-effort shim until CatalogService exposes it or is refactored further.
        return productIds.stream()
                .collect(java.util.stream.Collectors.toMap(
                        id -> id,
                        id -> {
                            try {
                                ProductResponse p = catalogService.getProduct(id);
                                return p.stock() != null ? p.stock() : 0;
                            } catch (Exception e) {
                                return 0;
                            }
                        }
                ));
    }

    @Override
    public Map<Long, String> loadSellerNameMap(List<Long> sellerIds) {
        // seller name map is internal to CatalogService — not directly exposed.
        // Return empty map; callers that need seller names should use getProduct() directly.
        return Map.of();
    }
}
