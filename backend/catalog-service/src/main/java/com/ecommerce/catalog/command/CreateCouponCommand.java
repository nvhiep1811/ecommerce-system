package com.ecommerce.catalog.command;

import com.ecommerce.catalog.dto.CreateCouponRequest;
import com.ecommerce.shared.security.AuthenticatedUser;

public record CreateCouponCommand(
        AuthenticatedUser principal,
        CreateCouponRequest request
) {
}
