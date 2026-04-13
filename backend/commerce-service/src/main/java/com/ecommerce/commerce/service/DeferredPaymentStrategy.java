package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public class DeferredPaymentStrategy implements PaymentMethodStrategy {

    private static final Set<String> SUPPORTED = Set.of("CARD", "BANK_TRANSFER", "VNPAY", "MOMO", "PAYPAL");

    @Override
    public boolean supports(String paymentMethodCode) {
        return paymentMethodCode != null && SUPPORTED.contains(paymentMethodCode.toUpperCase());
    }

    @Override
    public PaymentEntity createInitialPayment(OrderEntity order, int attemptNumber) {
        String method = order.getPaymentMethodCode().toUpperCase();
        PaymentEntity payment = new PaymentEntity();
        payment.setOrderId(order.getId());
        payment.setAttemptNo(attemptNumber);
        payment.setProvider(method);
        payment.setMethod(method);
        payment.setStatus("pending");
        payment.setAmount(order.getGrandTotal());
        payment.setCurrency("VND");
        payment.setGatewayMessage("Awaiting external gateway confirmation");
        return payment;
    }
}
