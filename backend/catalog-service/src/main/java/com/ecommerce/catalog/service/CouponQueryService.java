package com.ecommerce.catalog.service;

import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.dto.CouponValidationResponse;
import com.ecommerce.catalog.dto.CouponValidationRequest;
import com.ecommerce.shared.security.AuthenticatedUser;

import java.util.List;

/**
 * Read-only service for coupon queries.
 * Responsible for listing, fetching, and validating coupons — no state mutation.
 *
 * Note: validateCoupon uses POST due to complex request body but does NOT change coupon state.
 * Actual consumption is handled by CouponCommandService.
 */
public interface CouponQueryService {

    /**
     * Get a paginated list of available coupons.
     */
    List<CouponResponse> getCoupons(AuthenticatedUser principal, int page, int size);

    /**
     * Get a single coupon by ID.
     */
    CouponResponse getCouponById(Long couponId);

    /**
     * Validate a coupon against the given order context.
     * Does NOT consume the coupon — read-only check.
     */
    CouponValidationResponse validateCoupon(AuthenticatedUser principal, CouponValidationRequest request);
}
