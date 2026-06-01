package com.ecommerce.catalog.service;

import com.ecommerce.catalog.dto.CouponConsumeRequest;
import com.ecommerce.catalog.dto.CreateCouponRequest;
import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.dto.UpdateCouponRequest;
import com.ecommerce.shared.security.AuthenticatedUser;

/**
 * Write-only service for coupon mutations.
 * Responsible for create/update/delete/consume coupon and publishing outbox events.
 */
public interface CouponCommandService {

    /**
     * Create a new coupon.
     * Side effects: publish COUPON_CREATED outbox event.
     */
    CouponResponse createCoupon(AuthenticatedUser principal, CreateCouponRequest request);

    /**
     * Update an existing coupon.
     * Side effects: publish COUPON_UPDATED outbox event.
     */
    CouponResponse updateCoupon(AuthenticatedUser principal, Long couponId, UpdateCouponRequest request);

    /**
     * Delete a coupon.
     * Side effects: publish COUPON_DELETED outbox event.
     */
    void deleteCoupon(AuthenticatedUser principal, Long couponId);

    /**
     * Consume (redeem) a coupon — increments usage count.
     * Called by commerce-service after a successful order placement.
     * Side effects: publish COUPON_CONSUMED outbox event.
     */
    void consumeCoupon(AuthenticatedUser principal, CouponConsumeRequest request);
}
