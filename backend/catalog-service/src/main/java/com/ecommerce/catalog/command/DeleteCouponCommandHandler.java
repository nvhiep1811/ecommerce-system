package com.ecommerce.catalog.command;

import com.ecommerce.catalog.service.CouponCommandService;
import org.springframework.stereotype.Service;

@Service
public class DeleteCouponCommandHandler {

    private final CouponCommandService couponCommandService;

    public DeleteCouponCommandHandler(CouponCommandService couponCommandService) {
        this.couponCommandService = couponCommandService;
    }

    public void handle(DeleteCouponCommand command) {
        couponCommandService.deleteCoupon(command.principal(), command.couponId());
    }
}
