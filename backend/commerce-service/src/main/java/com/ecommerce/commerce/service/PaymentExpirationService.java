package com.ecommerce.commerce.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class PaymentExpirationService {

    private final PaymentService paymentService;

    public PaymentExpirationService(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @Scheduled(fixedDelayString = "${payment.expiration-scan-delay-ms:60000}")
    public void expirePendingOnlinePayments() {
        paymentService.expirePendingOnlinePayments();
    }
}
