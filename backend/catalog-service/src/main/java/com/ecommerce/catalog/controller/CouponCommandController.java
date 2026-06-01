package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.command.*;
import com.ecommerce.catalog.dto.CouponConsumeRequest;
import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.dto.CreateCouponRequest;
import com.ecommerce.catalog.dto.UpdateCouponRequest;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Handles all write coupon endpoints.
 */
@RestController
@RequestMapping("/catalog/coupons")
public class CouponCommandController {

    private final CreateCouponCommandHandler createCouponCommandHandler;
    private final UpdateCouponCommandHandler updateCouponCommandHandler;
    private final DeleteCouponCommandHandler deleteCouponCommandHandler;
    private final ConsumeCouponCommandHandler consumeCouponCommandHandler;

    public CouponCommandController(
            CreateCouponCommandHandler createCouponCommandHandler,
            UpdateCouponCommandHandler updateCouponCommandHandler,
            DeleteCouponCommandHandler deleteCouponCommandHandler,
            ConsumeCouponCommandHandler consumeCouponCommandHandler
    ) {
        this.createCouponCommandHandler = createCouponCommandHandler;
        this.updateCouponCommandHandler = updateCouponCommandHandler;
        this.deleteCouponCommandHandler = deleteCouponCommandHandler;
        this.consumeCouponCommandHandler = consumeCouponCommandHandler;
    }

    /**
     * POST /catalog/coupons
     */
    @PostMapping
    public ResponseEntity<CouponResponse> createCoupon(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestBody CreateCouponRequest request
    ) {
        var command = new CreateCouponCommand(principal, request);
        return ResponseEntity.ok(createCouponCommandHandler.handle(command));
    }

    /**
     * PUT /catalog/coupons/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<CouponResponse> updateCoupon(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long id,
            @RequestBody UpdateCouponRequest request
    ) {
        var command = new UpdateCouponCommand(principal, id, request);
        return ResponseEntity.ok(updateCouponCommandHandler.handle(command));
    }

    /**
     * DELETE /catalog/coupons/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCoupon(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @PathVariable Long id
    ) {
        var command = new DeleteCouponCommand(principal, id);
        deleteCouponCommandHandler.handle(command);
        return ResponseEntity.noContent().build();
    }

    /**
     * POST /catalog/coupons/consume
     * Called internally by commerce-service after successful order placement.
     */
    @PostMapping("/consume")
    public ResponseEntity<Void> consumeCoupon(
            @AuthenticationPrincipal AuthenticatedUser principal,
            @RequestBody CouponConsumeRequest request
    ) {
        var command = new ConsumeCouponCommand(principal, request);
        consumeCouponCommandHandler.handle(command);
        return ResponseEntity.ok().build();
    }
}
