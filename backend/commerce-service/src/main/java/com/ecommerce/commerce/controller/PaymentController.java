package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.config.SepayProperties;
import com.ecommerce.commerce.dto.SepayWebhookResponse;
import com.ecommerce.commerce.service.PaymentService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PaymentController {

    private final PaymentService paymentService;
    private final SepayProperties sepayProperties;

    public PaymentController(PaymentService paymentService, SepayProperties sepayProperties) {
        this.paymentService = paymentService;
        this.sepayProperties = sepayProperties;
    }

    @PostMapping({"/payments/sepay/ipn", "/commerce/payments/sepay/ipn", "/webhooks/sepay", "/commerce/webhooks/sepay"})
    public SepayWebhookResponse sepayIpn(
            @RequestBody JsonNode payload,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestHeader(value = "X-Secret-Key", required = false) String secretHeader
    ) {
        PaymentService.SepayWebhookOutcome outcome = paymentService.handleSepayWebhook(
                payload,
                authorization,
                secretHeader,
                resolveWebhookSecret()
        );
        return new SepayWebhookResponse(outcome.success(), outcome.message());
    }

    @GetMapping(value = {"/payments/{paymentId}/sepay-checkout", "/commerce/payments/{paymentId}/sepay-checkout"}, produces = MediaType.TEXT_HTML_VALUE)
    public String sepayCheckoutForm(@PathVariable("paymentId") Long paymentId) {
        return paymentService.renderSepayCheckoutForm(paymentId);
    }

    private String resolveWebhookSecret() {
        if (sepayProperties.getWebhookSecret() != null && !sepayProperties.getWebhookSecret().isBlank()) {
            return sepayProperties.getWebhookSecret();
        }
        return sepayProperties.getSecretKey();
    }
}
