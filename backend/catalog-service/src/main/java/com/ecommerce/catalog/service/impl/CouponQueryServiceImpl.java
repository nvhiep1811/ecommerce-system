package com.ecommerce.catalog.service.impl;

import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.dto.CouponValidationRequest;
import com.ecommerce.catalog.dto.CouponValidationResponse;
import com.ecommerce.catalog.service.CatalogService;
import com.ecommerce.catalog.service.CouponQueryService;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CouponQueryServiceImpl implements CouponQueryService {

    private final CatalogService catalogService;

    public CouponQueryServiceImpl(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @Override
    public List<CouponResponse> getCoupons(AuthenticatedUser principal, int page, int size) {
        // CatalogService.getCoupons() returns all active coupons — pagination applied here
        List<CouponResponse> all = catalogService.getCoupons();
        int fromIndex = Math.min(page * size, all.size());
        int toIndex = Math.min(fromIndex + size, all.size());
        return all.subList(fromIndex, toIndex);
    }

    @Override
    public CouponResponse getCouponById(Long couponId) {
        return catalogService.getCouponById(couponId);
    }

    @Override
    public CouponValidationResponse validateCoupon(AuthenticatedUser principal, CouponValidationRequest request) {
        return catalogService.validateCoupon(request);
    }
}
