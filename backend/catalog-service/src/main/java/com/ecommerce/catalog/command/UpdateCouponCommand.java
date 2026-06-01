package com.ecommerce.catalog.command;

import com.ecommerce.catalog.dto.UpdateCouponRequest;
import com.ecommerce.shared.security.AuthenticatedUser;

public record UpdateCouponCommand(
        AuthenticatedUser principal,
        Long couponId,
        UpdateCouponRequest request
) {
}
