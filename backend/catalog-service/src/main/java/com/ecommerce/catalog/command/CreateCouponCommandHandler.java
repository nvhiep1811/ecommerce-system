package com.ecommerce.catalog.command;

import com.ecommerce.catalog.dto.CouponResponse;
import com.ecommerce.catalog.service.CouponCommandService;
import org.springframework.stereotype.Service;

@Service
public class CreateCouponCommandHandler {

    private final CouponCommandService couponCommandService;

    public CreateCouponCommandHandler(CouponCommandService couponCommandService) {
        this.couponCommandService = couponCommandService;
    }

    public CouponResponse handle(CreateCouponCommand command) {
        return couponCommandService.createCoupon(command.principal(), command.request());
    }
}
