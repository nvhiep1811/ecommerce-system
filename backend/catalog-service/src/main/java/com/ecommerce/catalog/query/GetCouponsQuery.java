package com.ecommerce.catalog.query;

import com.ecommerce.shared.security.AuthenticatedUser;

public record GetCouponsQuery(
        AuthenticatedUser principal,
        int page,
        int size
) {
}
