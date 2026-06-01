package com.ecommerce.catalog.command;

import com.ecommerce.catalog.dto.ProductImageUploadResponse;
import com.ecommerce.catalog.service.ProductCommandService;
import org.springframework.stereotype.Service;

@Service
public class UploadProductImageCommandHandler {

    private final ProductCommandService productCommandService;

    public UploadProductImageCommandHandler(ProductCommandService productCommandService) {
        this.productCommandService = productCommandService;
    }

    public ProductImageUploadResponse handle(UploadProductImageCommand command) {
        return productCommandService.uploadProductImage(command.principal(), command.file());
    }
}
