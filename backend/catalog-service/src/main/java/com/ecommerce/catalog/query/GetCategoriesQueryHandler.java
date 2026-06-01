package com.ecommerce.catalog.query;

import com.ecommerce.catalog.dto.CategoryResponse;
import com.ecommerce.catalog.service.CategoryQueryService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GetCategoriesQueryHandler {

    private final CategoryQueryService categoryQueryService;

    public GetCategoriesQueryHandler(CategoryQueryService categoryQueryService) {
        this.categoryQueryService = categoryQueryService;
    }

    public List<CategoryResponse> handle(GetCategoriesQuery query) {
        return categoryQueryService.getCategories(query.parentId());
    }
}
