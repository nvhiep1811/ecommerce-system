package com.ecommerce.catalog.command;

import com.ecommerce.catalog.dto.ProductUpsertRequest;
import com.ecommerce.shared.security.AuthenticatedUser;

public record CreateProductCommand(
        AuthenticatedUser principal,
        ProductUpsertRequest request
) {
}
