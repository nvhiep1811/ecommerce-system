package com.ecommerce.catalog.service;

import com.ecommerce.catalog.dto.ProductImageUploadResponse;
import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.dto.ProductUpsertRequest;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.web.multipart.MultipartFile;

/**
 * Write-only service for product mutations.
 */
public interface ProductCommandService {

    /** Create product, sync inventory, evict cache, publish PRODUCT_CREATED. */
    ProductResponse createProduct(AuthenticatedUser principal, ProductUpsertRequest request);

    /** Update product, sync inventory, evict cache, publish PRODUCT_UPDATED. */
    ProductResponse updateProduct(AuthenticatedUser principal, Long productId, ProductUpsertRequest request);

    /** Upload product image to object storage, return public URL. */
    ProductImageUploadResponse uploadProductImage(AuthenticatedUser principal, MultipartFile file);

    /** Backfill embeddings for all products that have none. */
    void backfillEmbeddings(AuthenticatedUser principal);
}
