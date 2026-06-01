package com.ecommerce.catalog.command;

import com.ecommerce.catalog.service.ProductCommandService;
import org.springframework.stereotype.Service;

@Service
public class BackfillEmbeddingsCommandHandler {

    private final ProductCommandService productCommandService;

    public BackfillEmbeddingsCommandHandler(ProductCommandService productCommandService) {
        this.productCommandService = productCommandService;
    }

    public void handle(BackfillEmbeddingsCommand command) {
        productCommandService.backfillEmbeddings(command.principal());
    }
}
