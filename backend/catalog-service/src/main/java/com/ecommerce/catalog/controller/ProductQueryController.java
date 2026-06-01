package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.dto.ProductPageResponse;
import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.query.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Handles all read-only product endpoints.
 */
@RestController
@RequestMapping("/catalog/products")
public class ProductQueryController {

    private final GetProductPageQueryHandler getProductPageQueryHandler;
    private final GetProductDetailQueryHandler getProductDetailQueryHandler;
    private final SearchProductsQueryHandler searchProductsQueryHandler;
    private final SemanticProductSearchQueryHandler semanticProductSearchQueryHandler;

    public ProductQueryController(
            GetProductPageQueryHandler getProductPageQueryHandler,
            GetProductDetailQueryHandler getProductDetailQueryHandler,
            SearchProductsQueryHandler searchProductsQueryHandler,
            SemanticProductSearchQueryHandler semanticProductSearchQueryHandler
    ) {
        this.getProductPageQueryHandler = getProductPageQueryHandler;
        this.getProductDetailQueryHandler = getProductDetailQueryHandler;
        this.searchProductsQueryHandler = searchProductsQueryHandler;
        this.semanticProductSearchQueryHandler = semanticProductSearchQueryHandler;
    }

    /**
     * GET /catalog/products
     * Search or list products with keyword/category filter.
     */
    @GetMapping
    public ResponseEntity<ProductPageResponse> getProducts(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        var query = new SearchProductsQuery(keyword, categoryId, page, size);
        return ResponseEntity.ok(searchProductsQueryHandler.handle(query));
    }

    /**
     * GET /catalog/products/page
     * Paginated product listing with seller/category filter. Uses Redis cache.
     */
    @GetMapping("/page")
    public ResponseEntity<ProductPageResponse> getProductsPage(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String categoryId,
            @RequestParam(required = false) String sellerId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String direction
    ) {
        var query = new GetProductPageQuery(page, size, categoryId, sellerId, keyword, sort, direction);
        return ResponseEntity.ok(getProductPageQueryHandler.handle(query));
    }

    /**
     * GET /catalog/products/semantic
     * Semantic (vector) search.
     */
    @GetMapping("/semantic")
    public ResponseEntity<List<ProductResponse>> searchSemantic(
            @RequestParam String query,
            @RequestParam(defaultValue = "10") int topK
    ) {
        var searchQuery = new SemanticProductSearchQuery(query, topK);
        return ResponseEntity.ok(semanticProductSearchQueryHandler.handle(searchQuery));
    }

    /**
     * GET /catalog/products/{id}
     * Get product detail by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ProductResponse> getProduct(@PathVariable Long id) {
        var query = new GetProductDetailQuery(id);
        return ResponseEntity.ok(getProductDetailQueryHandler.handle(query));
    }
}
