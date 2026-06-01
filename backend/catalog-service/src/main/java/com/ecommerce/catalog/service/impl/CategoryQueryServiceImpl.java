package com.ecommerce.catalog.service.impl;

import com.ecommerce.catalog.dto.CategoryResponse;
import com.ecommerce.catalog.service.CatalogService;
import com.ecommerce.catalog.service.CategoryQueryService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CategoryQueryServiceImpl implements CategoryQueryService {

    private final CatalogService catalogService;

    public CategoryQueryServiceImpl(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @Override
    public List<CategoryResponse> getCategories(String parentId) {
        Long parentIdLong = parentId != null ? Long.parseLong(parentId) : null;
        return catalogService.getCategories(parentIdLong);
    }

    @Override
    public Map<Long, String> resolveCategoryIds(List<Long> categoryIds) {
        return catalogService.getCategories(null).stream()
                .filter(c -> categoryIds.contains(c.id()))
                .collect(Collectors.toMap(CategoryResponse::id, CategoryResponse::name));
    }
}
