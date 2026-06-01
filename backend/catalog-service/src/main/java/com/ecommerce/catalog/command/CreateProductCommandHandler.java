package com.ecommerce.catalog.command;

import com.ecommerce.catalog.dto.ProductResponse;
import com.ecommerce.catalog.service.ProductCommandService;
import org.springframework.stereotype.Service;

@Service
public class CreateProductCommandHandler {

    private final ProductCommandService productCommandService;

    public CreateProductCommandHandler(ProductCommandService productCommandService) {
        this.productCommandService = productCommandService;
    }

    public ProductResponse handle(CreateProductCommand command) {
        return productCommandService.createProduct(command.principal(), command.request());
    }
}
