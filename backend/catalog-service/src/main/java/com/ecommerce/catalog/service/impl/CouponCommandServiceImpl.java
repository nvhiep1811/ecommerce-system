package com.ecommerce.catalog.service.impl;

import com.ecommerce.catalog.dto.CouponConsumeRequest;
import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.dto.CreateCouponRequest;
import com.ecommerce.catalog.dto.UpdateCouponRequest;
import com.ecommerce.catalog.service.CatalogService;
import com.ecommerce.catalog.service.CouponCommandService;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.stereotype.Service;

@Service
public class CouponCommandServiceImpl implements CouponCommandService {

    private final CatalogService catalogService;

    public CouponCommandServiceImpl(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @Override
    public CouponResponse createCoupon(AuthenticatedUser principal, CreateCouponRequest request) {
        return catalogService.createCoupon(request);
    }

    @Override
    public CouponResponse updateCoupon(AuthenticatedUser principal, Long couponId, UpdateCouponRequest request) {
        return catalogService.updateCoupon(couponId, request);
    }

    @Override
    public void deleteCoupon(AuthenticatedUser principal, Long couponId) {
        catalogService.deleteCoupon(couponId);
    }

    @Override
    public void consumeCoupon(AuthenticatedUser principal, CouponConsumeRequest request) {
        catalogService.consumeCoupon(request);
    }
}
