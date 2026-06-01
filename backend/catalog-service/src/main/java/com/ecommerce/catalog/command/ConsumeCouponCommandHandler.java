package com.ecommerce.catalog.command;

import com.ecommerce.catalog.service.CouponCommandService;
import org.springframework.stereotype.Service;

@Service
public class ConsumeCouponCommandHandler {

    private final CouponCommandService couponCommandService;

    public ConsumeCouponCommandHandler(CouponCommandService couponCommandService) {
        this.couponCommandService = couponCommandService;
    }

    public void handle(ConsumeCouponCommand command) {
        couponCommandService.consumeCoupon(command.principal(), command.request());
    }
}
