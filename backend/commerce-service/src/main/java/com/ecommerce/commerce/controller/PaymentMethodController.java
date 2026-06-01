package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.PaymentMethodsResponse;
import com.ecommerce.commerce.service.PaymentMethodService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PaymentMethodController {

    private final PaymentMethodService paymentMethodService;

    public PaymentMethodController(PaymentMethodService paymentMethodService) {
        this.paymentMethodService = paymentMethodService;
    }

    @GetMapping({"/payment-methods", "/commerce/payment-methods"})
    public PaymentMethodsResponse listMethods() {
        return paymentMethodService.listMethods();
    }
}
