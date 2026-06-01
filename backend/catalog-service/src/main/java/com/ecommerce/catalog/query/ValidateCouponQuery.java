package com.ecommerce.catalog.query;

import com.ecommerce.catalog.dto.CouponValidationRequest;
import com.ecommerce.shared.security.AuthenticatedUser;

public record ValidateCouponQuery(
        AuthenticatedUser principal,
        CouponValidationRequest request
) {
}
