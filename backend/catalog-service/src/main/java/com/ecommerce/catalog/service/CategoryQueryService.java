package com.ecommerce.catalog.service;

import com.ecommerce.catalog.dto.CategoryResponse;

import java.util.List;
import java.util.Map;

/**
 * Read-only service for category queries.
 * If admin CRUD for categories is needed later, add CategoryCommandService.
 */
public interface CategoryQueryService {

    /**
     * Get all categories, optionally filtered by parentId.
     */
    List<CategoryResponse> getCategories(String parentId);

    /**
     * Resolve a list of category IDs to their names (used for product enrichment).
     */
    Map<Long, String> resolveCategoryIds(List<Long> categoryIds);
}
