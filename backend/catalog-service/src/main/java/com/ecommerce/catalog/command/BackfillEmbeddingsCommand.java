package com.ecommerce.catalog.command;

import com.ecommerce.shared.security.AuthenticatedUser;

public record BackfillEmbeddingsCommand(
        AuthenticatedUser principal
) {
}
