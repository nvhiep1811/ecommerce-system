package com.ecommerce.catalog.query;

import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.service.CouponQueryService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class GetCouponsQueryHandler {

    private final CouponQueryService couponQueryService;

    public GetCouponsQueryHandler(CouponQueryService couponQueryService) {
        this.couponQueryService = couponQueryService;
    }

    public List<CouponResponse> handle(GetCouponsQuery query) {
        return couponQueryService.getCoupons(query.principal(), query.page(), query.size());
    }
}
