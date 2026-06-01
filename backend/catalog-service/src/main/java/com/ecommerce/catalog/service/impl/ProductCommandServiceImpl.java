package com.ecommerce.catalog.service.impl;

import com.ecommerce.catalog.dto.ProductImageUploadResponse;
import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.dto.ProductUpsertRequest;
import com.ecommerce.catalog.service.CatalogService;
import com.ecommerce.catalog.service.ProductCommandService;
import com.ecommerce.catalog.service.ProductImageStorageService;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ProductCommandServiceImpl implements ProductCommandService {

    private final CatalogService catalogService;
    private final ProductImageStorageService productImageStorageService;

    public ProductCommandServiceImpl(CatalogService catalogService, ProductImageStorageService productImageStorageService) {
        this.catalogService = catalogService;
        this.productImageStorageService = productImageStorageService;
    }

    @Override
    public ProductResponse createProduct(AuthenticatedUser principal, ProductUpsertRequest request) {
        return catalogService.createProduct(principal, request);
    }

    @Override
    public ProductResponse updateProduct(AuthenticatedUser principal, Long productId, ProductUpsertRequest request) {
        return catalogService.updateProduct(principal, productId, request);
    }

    @Override
    public ProductImageUploadResponse uploadProductImage(AuthenticatedUser principal, MultipartFile file) {
        var uploaded = productImageStorageService.uploadProductImage(principal, file);
        return new ProductImageUploadResponse(uploaded.objectPath(), uploaded.publicUrl());
    }

    @Override
    public void backfillEmbeddings(AuthenticatedUser principal) {
        catalogService.backfillEmbeddings();
    }
}
