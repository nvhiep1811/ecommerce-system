package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.SepayProperties;
import com.ecommerce.commerce.config.VietQrProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SepayPaymentGatewayTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void createSepayQrPaymentShouldReturnQrCodeUrlWhenVietQrEnabledAndConfigValid() {
        SepayPaymentGateway gateway = gateway(validVietQrProperties(false), sepayProperties());

        CreatePaymentResult result = gateway.createPayment(command());

        assertTrue(result.qrCodeUrl().startsWith("https://img.vietqr.io/image/970422-29120044002192-compact2.png"));
        assertTrue(result.qrCodeUrl().contains("amount=1500000"));
        assertTrue(result.qrCodeUrl().contains("addInfo=INV-TEST-1"));
        assertEquals("29120044002192", result.bankAccountNumber());
        assertEquals("NGUYEN VO HIEP", result.accountName());
        assertEquals("mb", result.bankCode());
        assertEquals("970422", result.bankBin());
    }

    @Test
    void createSepayQrPaymentShouldReturnBankDeepLinkWhenDeeplinkEnabledAndSupported() {
        SepayPaymentGateway gateway = gateway(validVietQrProperties(true), sepayProperties());

        CreatePaymentResult result = gateway.createPayment(command());

        assertTrue(result.bankDeepLink().startsWith("https://dl.vietqr.io/pay?"));
        assertTrue(result.bankDeepLink().contains("app=mb"));
        assertTrue(result.bankDeepLink().contains("29120044002192"));
        assertTrue(result.bankDeepLink().contains("mb"));
        assertTrue(result.bankDeepLink().contains("am=1500000"));
        assertTrue(result.bankDeepLink().contains("tn=INV-TEST-1"));
        assertTrue(result.bankDeepLink().contains("bn=NGUYEN%20VO%20HIEP"));
    }

    @Test
    void createSepayQrPaymentShouldReturnNullBankDeepLinkWhenDeeplinkDisabled() {
        SepayPaymentGateway gateway = gateway(validVietQrProperties(false), sepayProperties());

        CreatePaymentResult result = gateway.createPayment(command());

        assertNull(result.bankDeepLink());
    }

    @Test
    void createSepayQrPaymentShouldFallbackToManualTransferInfoWhenVietQrConfigMissing() {
        VietQrProperties vietQrProperties = new VietQrProperties();
        vietQrProperties.setEnabled(true);
        SepayProperties sepayProperties = sepayProperties();
        SepayPaymentGateway gateway = gateway(vietQrProperties, sepayProperties);

        CreatePaymentResult result = gateway.createPayment(command());

        assertTrue(result.qrCodeUrl().startsWith("https://qr.sepay.vn/img?"));
        assertEquals(sepayProperties.getBankName(), result.bankName());
        assertEquals(sepayProperties.getBankAccountNumber(), result.bankAccountNumber());
        assertEquals(sepayProperties.getAccountName(), result.accountName());
        assertEquals("INV-TEST-1", result.transferContent());
        assertNull(result.bankDeepLink());
    }

    private SepayPaymentGateway gateway(VietQrProperties vietQrProperties, SepayProperties sepayProperties) {
        return new SepayPaymentGateway(
                sepayProperties,
                new VietQrService(vietQrProperties),
                objectMapper
        );
    }

    private VietQrProperties validVietQrProperties(boolean deeplinkEnabled) {
        VietQrProperties properties = new VietQrProperties();
        properties.setEnabled(true);
        properties.setQrBaseUrl("https://img.vietqr.io/image");
        properties.setDeeplinkBaseUrl("https://dl.vietqr.io/pay");
        properties.setBankBin("970422");
        properties.setBankCode("mb");
        properties.setAccountNo("29120044002192");
        properties.setAccountName("NGUYEN VO HIEP");
        properties.setTemplate("compact2");
        properties.setDeeplinkEnabled(deeplinkEnabled);
        properties.setDeeplinkAppCode(deeplinkEnabled ? "mb" : "");
        return properties;
    }

    private SepayProperties sepayProperties() {
        SepayProperties properties = new SepayProperties();
        properties.setQrEndpoint("https://qr.sepay.vn/img");
        properties.setBankName("Ngân hàng TMCP Quân đội");
        properties.setBankAccountNumber("29120044002192");
        properties.setAccountName("Nguyen Vo Hiep");
        return properties;
    }

    private CreatePaymentCommand command() {
        return new CreatePaymentCommand(
                10L,
                "ORD-10",
                UUID.randomUUID(),
                "buyer@example.com",
                "Nguyen Van A",
                PaymentConstants.METHOD_SEPAY_QR,
                "INV-TEST-1",
                new BigDecimal("1500000"),
                "VND",
                OffsetDateTime.now().plusMinutes(15)
        );
    }
}
