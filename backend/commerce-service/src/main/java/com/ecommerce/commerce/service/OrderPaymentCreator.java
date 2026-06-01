package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.stereotype.Service;

@Service
public class OrderPaymentCreator {

    private final PaymentService paymentService;

    public OrderPaymentCreator(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    public PaymentEntity createInitialPayment(OrderEntity order, AuthenticatedUser principal) {
        return paymentService.createInitialPayment(order, principal);
    }
}
