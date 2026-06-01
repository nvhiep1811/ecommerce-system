package com.ecommerce.catalog.query;

import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.service.CouponQueryService;
import org.springframework.stereotype.Service;

@Service
public class GetCouponDetailQueryHandler {

    private final CouponQueryService couponQueryService;

    public GetCouponDetailQueryHandler(CouponQueryService couponQueryService) {
        this.couponQueryService = couponQueryService;
    }

    public CouponResponse handle(GetCouponDetailQuery query) {
        return couponQueryService.getCouponById(query.couponId());
    }
}
