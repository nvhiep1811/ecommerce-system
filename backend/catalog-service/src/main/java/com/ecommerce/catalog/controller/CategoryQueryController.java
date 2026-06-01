package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.dto.CategoryResponse;
import com.ecommerce.catalog.query.GetCategoriesQuery;
import com.ecommerce.catalog.query.GetCategoriesQueryHandler;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Handles all read-only category endpoints.
 * If admin CRUD is needed later, add CategoryCommandController.
 */
@RestController
@RequestMapping("/catalog/categories")
public class CategoryQueryController {

    private final GetCategoriesQueryHandler getCategoriesQueryHandler;

    public CategoryQueryController(GetCategoriesQueryHandler getCategoriesQueryHandler) {
        this.getCategoriesQueryHandler = getCategoriesQueryHandler;
    }

    /**
     * GET /catalog/categories
     */
    @GetMapping
    public ResponseEntity<List<CategoryResponse>> getCategories(
            @RequestParam(required = false) String parentId
    ) {
        var query = new GetCategoriesQuery(parentId);
        return ResponseEntity.ok(getCategoriesQueryHandler.handle(query));
    }
}
