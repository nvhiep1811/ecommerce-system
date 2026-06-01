package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.PaymentProperties;
import com.ecommerce.commerce.config.SepayProperties;
import com.ecommerce.commerce.dto.PaymentMethodsResponse;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PaymentMethodServiceTest {

    @Test
    void getPaymentMethodsShouldReturnEnabledMethods() {
        PaymentProperties paymentProperties = new PaymentProperties();
        SepayProperties sepayProperties = new SepayProperties();
        sepayProperties.getMethods().setApplePayEnabled(false);
        sepayProperties.getMethods().setGooglePayEnabled(false);

        PaymentMethodService service = new PaymentMethodService(paymentProperties, sepayProperties);

        PaymentMethodsResponse response = service.listMethods();

        assertTrue(response.methods().stream().anyMatch(method -> "COD".equals(method.code()) && method.enabled()));
        assertTrue(response.methods().stream().anyMatch(method -> "SEPAY_QR".equals(method.code()) && method.enabled()));
        assertTrue(response.methods().stream().anyMatch(method -> "SEPAY_CHECKOUT".equals(method.code()) && method.enabled()));
        assertFalse(response.methods().stream().filter(method -> "APPLE_PAY".equals(method.code())).findFirst().orElseThrow().enabled());
        assertFalse(response.methods().stream().filter(method -> "GOOGLE_PAY".equals(method.code())).findFirst().orElseThrow().enabled());
    }
}
