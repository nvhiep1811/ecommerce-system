package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.ShippingMethodsResponse;
import com.ecommerce.commerce.service.ShippingMethodService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ShippingMethodController {

    private final ShippingMethodService shippingMethodService;

    public ShippingMethodController(ShippingMethodService shippingMethodService) {
        this.shippingMethodService = shippingMethodService;
    }

    @GetMapping({"/shipping-methods", "/commerce/shipping-methods"})
    public ShippingMethodsResponse listMethods() {
        return shippingMethodService.listMethods();
    }
}
