package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.dto.CouponValidationResponse;
import com.ecommerce.catalog.dto.CouponValidationRequest;
import com.ecommerce.catalog.query.*;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Handles all read-only coupon endpoints.
 *
 * Note: POST /catalog/coupons/validate uses POST due to complex body
 * but does NOT mutate state — treated as a query.
 */
@RestController
@RequestMapping("/catalog/coupons")
public class CouponQueryController {

    private final GetCouponsQueryHandler getCouponsQueryHandler;
    private final GetCouponDetailQueryHandler getCouponDetailQueryHandler;
    private final ValidateCouponQueryHandler validateCouponQueryHandler;

    public CouponQueryController(
            GetCouponsQueryHandler getCouponsQueryHandler,
            GetCouponDetailQueryHandler getCouponDetailQueryHandler,
            ValidateCouponQueryHandler validateCouponQueryHandler
    ) {
        this.getCouponsQueryHandler = getCouponsQueryHandler;
        this.getCouponDetailQueryHandler = getCouponDetailQueryHandler;
        this.validateCouponQueryHandler = validateCouponQueryHandler;
    }

    /**
     * GET /catalog/coupons
     */
    @GetMapping
    public ResponseEntity<List<CouponResponse>> getCoupons(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        var query = new GetCouponsQuery(principal, page, size);
        return ResponseEntity.ok(getCouponsQueryHandler.handle(query));
    }

    /**
     * GET /catalog/coupons/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<CouponResponse> getCouponById(@PathVariable Long id) {
        var query = new GetCouponDetailQuery(id);
        return ResponseEntity.ok(getCouponDetailQueryHandler.handle(query));
    }

    /**
     * POST /catalog/coupons/validate
     * Read-only validation — does NOT consume the coupon.
     */
    @PostMapping("/validate")
    public ResponseEntity<CouponValidationResponse> validateCoupon(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestBody CouponValidationRequest request
    ) {
        var query = new ValidateCouponQuery(principal, request);
        return ResponseEntity.ok(validateCouponQueryHandler.handle(query));
    }
}
