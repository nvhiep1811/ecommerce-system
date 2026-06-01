package com.ecommerce.catalog.query;

import com.ecommerce.catalog.dto.CouponValidationResponse;
import com.ecommerce.catalog.service.CouponQueryService;
import org.springframework.stereotype.Service;

@Service
public class ValidateCouponQueryHandler {

    private final CouponQueryService couponQueryService;

    public ValidateCouponQueryHandler(CouponQueryService couponQueryService) {
        this.couponQueryService = couponQueryService;
    }

    public CouponValidationResponse handle(ValidateCouponQuery query) {
        return couponQueryService.validateCoupon(query.principal(), query.request());
    }
}
