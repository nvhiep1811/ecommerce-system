package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.dto.ProductImageUploadResponse;
import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.dto.ProductPageResponse;
import com.ecommerce.catalog.dto.ProductUpsertRequest;
import com.ecommerce.catalog.service.CatalogService;
import com.ecommerce.catalog.service.ProductImageStorageService;
import com.ecommerce.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
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
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/catalog/products")
public class ProductController {

    private final CatalogService catalogService;
    private final ProductImageStorageService productImageStorageService;

    public ProductController(CatalogService catalogService, ProductImageStorageService productImageStorageService) {
        this.catalogService = catalogService;
        this.productImageStorageService = productImageStorageService;
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

    @GetMapping("/page")
    public ProductPageResponse page(
            @RequestParam(name = "categoryId", required = false) Long categoryId,
            @RequestParam(name = "sellerId", required = false) UUID sellerId,
            @RequestParam(name = "search", required = false) String search,
            @RequestParam(name = "featured", defaultValue = "false") boolean featured,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @RequestParam(name = "sort", defaultValue = "createdAt") String sort,
            @RequestParam(name = "direction", defaultValue = "desc") String direction
    ) {
        return catalogService.getProductsPage(categoryId, sellerId, search, featured, page, size, sort, direction);
    }

    @GetMapping("/{id}")
    public ProductResponse get(@PathVariable("id") Long id) {
        return catalogService.getProduct(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductResponse create(Authentication authentication, @Valid @RequestBody ProductUpsertRequest request) {
        return catalogService.createProduct((AuthenticatedUser) authentication.getPrincipal(), request);
    }

    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('SELLER')")
    public ProductImageUploadResponse uploadImage(
            Authentication authentication,
            @RequestParam("file") MultipartFile file
    ) {
        ProductImageStorageService.UploadedObject uploadedObject = productImageStorageService.uploadProductImage(
                (AuthenticatedUser) authentication.getPrincipal(),
                file
        );
        return new ProductImageUploadResponse(uploadedObject.objectPath(), uploadedObject.publicUrl());
    }

    @PutMapping("/{id}")
    public ProductResponse update(Authentication authentication, @PathVariable("id") Long id, @Valid @RequestBody ProductUpsertRequest request) {
        return catalogService.updateProduct((AuthenticatedUser) authentication.getPrincipal(), id, request);
    }
}
