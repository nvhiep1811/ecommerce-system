package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.command.*;
import com.ecommerce.catalog.dto.ProductUpsertRequest;
import com.ecommerce.catalog.dto.ProductImageUploadResponse;
import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * Handles all write product endpoints.
 *
 * Note: POST /catalog/products/backfill-embeddings replaces the old GET endpoint.
 * The GET variant should be kept temporarily as deprecated if clients still use it.
 */
@RestController
@RequestMapping("/catalog/products")
public class ProductCommandController {

    private final CreateProductCommandHandler createProductCommandHandler;
    private final UpdateProductCommandHandler updateProductCommandHandler;
    private final UploadProductImageCommandHandler uploadProductImageCommandHandler;
    private final BackfillEmbeddingsCommandHandler backfillEmbeddingsCommandHandler;

    public ProductCommandController(
            CreateProductCommandHandler createProductCommandHandler,
            UpdateProductCommandHandler updateProductCommandHandler,
            UploadProductImageCommandHandler uploadProductImageCommandHandler,
            BackfillEmbeddingsCommandHandler backfillEmbeddingsCommandHandler
    ) {
        this.createProductCommandHandler = createProductCommandHandler;
        this.updateProductCommandHandler = updateProductCommandHandler;
        this.uploadProductImageCommandHandler = uploadProductImageCommandHandler;
        this.backfillEmbeddingsCommandHandler = backfillEmbeddingsCommandHandler;
    }

    /**
     * POST /catalog/products
     */
    @PostMapping
    public ResponseEntity<ProductResponse> createProduct(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestBody ProductUpsertRequest request
    ) {
        var command = new CreateProductCommand(principal, request);
        return ResponseEntity.ok(createProductCommandHandler.handle(command));
    }

    /**
     * PUT /catalog/products/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ProductResponse> updateProduct(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long id,
            @RequestBody ProductUpsertRequest request
    ) {
        var command = new UpdateProductCommand(principal, id, request);
        return ResponseEntity.ok(updateProductCommandHandler.handle(command));
    }

    /**
     * POST /catalog/products/images
     */
    @PostMapping("/images")
    public ResponseEntity<ProductImageUploadResponse> uploadProductImage(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam("file") MultipartFile file
    ) {
        var command = new UploadProductImageCommand(principal, file);
        return ResponseEntity.ok(uploadProductImageCommandHandler.handle(command));
    }

    /**
     * POST /catalog/products/backfill-embeddings
     * Replaces the previous GET endpoint — this is a mutation operation.
     */
    @PostMapping("/backfill-embeddings")
    public ResponseEntity<Void> backfillEmbeddings(@AuthenticationPrincipal AuthenticatedUser principal) {
        var command = new BackfillEmbeddingsCommand(principal);
        backfillEmbeddingsCommandHandler.handle(command);
        return ResponseEntity.accepted().build();
    }
}
