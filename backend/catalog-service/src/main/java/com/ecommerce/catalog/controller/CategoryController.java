package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.dto.CategoryResponse;
import com.ecommerce.catalog.service.CatalogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/catalog/categories")
public class CategoryController {

    private final CatalogService catalogService;

    public CategoryController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping
    public List<CategoryResponse> list(@RequestParam(required = false) Long parentId) {
        return catalogService.getCategories(parentId);
    }
}
