package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;

public interface PaymentMethodStrategy {

    boolean supports(String paymentMethodCode);

    PaymentEntity createInitialPayment(OrderEntity order, int attemptNumber);
}
