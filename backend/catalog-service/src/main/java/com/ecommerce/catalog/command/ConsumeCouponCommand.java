package com.ecommerce.catalog.command;

import com.ecommerce.catalog.dto.CouponConsumeRequest;
import com.ecommerce.shared.security.AuthenticatedUser;

public record ConsumeCouponCommand(
        AuthenticatedUser principal,
        CouponConsumeRequest request
) {
}
