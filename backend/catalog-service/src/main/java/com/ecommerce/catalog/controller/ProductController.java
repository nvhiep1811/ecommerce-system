package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.dto.ProductUpsertRequest;
import com.ecommerce.catalog.service.CatalogService;
import com.ecommerce.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/catalog/products")
public class ProductController {

    private final CatalogService catalogService;

    public ProductController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping
    public List<ProductResponse> list(
            @RequestParam(name = "categoryId", required = false) Long categoryId,
            @RequestParam(name = "sellerId", required = false) UUID sellerId,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "featured", defaultValue = "false") boolean featured
    ) {
        return catalogService.getProducts(categoryId, sellerId, search, featured);
    }

    @GetMapping("/{id}")
    public ProductResponse get(@PathVariable("id") Long id) {
        return catalogService.getProduct(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(Authentication authentication, @Valid @RequestBody ProductUpsertRequest request) {
        System.out.println(authentication.getPrincipal().getClass());
        try {
            // logic
            return catalogService.createProduct((AuthenticatedUser) authentication.getPrincipal(), request);
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }

    @PutMapping("/{id}")
    public ProductResponse update(Authentication authentication, @PathVariable("id") Long id, @Valid @RequestBody ProductUpsertRequest request) {
        return catalogService.updateProduct((AuthenticatedUser) authentication.getPrincipal(), id, request);
    }
}