package com.ecommerce.commerce.service;

public interface PaymentGateway {

    boolean supports(String paymentMethodCode);

    String provider();

    CreatePaymentResult createPayment(CreatePaymentCommand command);
}
