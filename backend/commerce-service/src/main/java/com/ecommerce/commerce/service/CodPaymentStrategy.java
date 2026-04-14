package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import org.springframework.stereotype.Component;

@Component
public class CodPaymentStrategy implements PaymentMethodStrategy {

    @Override
    public boolean supports(String paymentMethodCode) {
        return "COD".equalsIgnoreCase(paymentMethodCode);
    }

    @Override
    public PaymentEntity createInitialPayment(OrderEntity order, int attemptNumber) {
        PaymentEntity payment = new PaymentEntity();
        payment.setOrderId(order.getId());
        payment.setAttemptNo(attemptNumber);
        payment.setProvider("COD");
        payment.setMethod("COD");
        payment.setStatus("pending");
        payment.setAmount(order.getGrandTotal());
        payment.setCurrency("VND");
        payment.setGatewayMessage("Cash on delivery initialized");
        return payment;
    }
}
