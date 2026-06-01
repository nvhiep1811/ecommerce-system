package com.ecommerce.catalog.command;

import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.service.CouponCommandService;
import org.springframework.stereotype.Service;

@Service
public class UpdateCouponCommandHandler {

    private final CouponCommandService couponCommandService;

    public UpdateCouponCommandHandler(CouponCommandService couponCommandService) {
        this.couponCommandService = couponCommandService;
    }

    public CouponResponse handle(UpdateCouponCommand command) {
        return couponCommandService.updateCoupon(command.principal(), command.couponId(), command.request());
    }
}
