package com.ecommerce.catalog.command;

import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.service.ProductCommandService;
import org.springframework.stereotype.Service;

@Service
public class UpdateProductCommandHandler {

    private final ProductCommandService productCommandService;

    public UpdateProductCommandHandler(ProductCommandService productCommandService) {
        this.productCommandService = productCommandService;
    }

    public ProductResponse handle(UpdateProductCommand command) {
        return productCommandService.updateProduct(command.principal(), command.productId(), command.request());
    }
}
