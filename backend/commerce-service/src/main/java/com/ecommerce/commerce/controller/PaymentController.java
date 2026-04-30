package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.config.SepayProperties;
import com.ecommerce.commerce.dto.SepayWebhookResponse;
import com.ecommerce.commerce.dto.VietQrBankAppsResponse;
import com.ecommerce.commerce.service.PaymentService;
import com.ecommerce.commerce.service.VietQrBankAppService;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

@RestController
@Slf4j
public class PaymentController {

    private final PaymentService paymentService;
    private final VietQrBankAppService vietQrBankAppService;
    private final SepayProperties sepayProperties;

    public PaymentController(
            PaymentService paymentService,
            VietQrBankAppService vietQrBankAppService,
            SepayProperties sepayProperties
    ) {
        this.paymentService = paymentService;
        this.vietQrBankAppService = vietQrBankAppService;
        this.sepayProperties = sepayProperties;
    }

    @PostMapping({"/payments/sepay/ipn", "/commerce/payments/sepay/ipn", "/webhooks/sepay", "/commerce/webhooks/sepay"})
    public SepayWebhookResponse sepayIpn(
            @RequestBody JsonNode payload,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestHeader(value = "X-Secret-Key", required = false) String secretHeader
    ) {
        log.info(
                "Received SePay IPN; authorizationPresent={}, secretHeaderPresent={}, payloadFields={}",
                authorization != null && !authorization.isBlank(),
                secretHeader != null && !secretHeader.isBlank(),
                fieldNames(payload)
        );
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

    @GetMapping({"/payments/{paymentId}/bank-apps", "/commerce/payments/{paymentId}/bank-apps"})
    public VietQrBankAppsResponse bankApps(
            Authentication authentication,
            @PathVariable("paymentId") Long paymentId,
            @RequestParam(name = "platform", defaultValue = "android") String platform
    ) {
        return vietQrBankAppService.listForPayment((AuthenticatedUser) authentication.getPrincipal(), paymentId, platform);
    }

    private String resolveWebhookSecret() {
        if (sepayProperties.getWebhookSecret() != null && !sepayProperties.getWebhookSecret().isBlank()) {
            return sepayProperties.getWebhookSecret();
        }
        return sepayProperties.getSecretKey();
    }

    private List<String> fieldNames(JsonNode payload) {
        List<String> names = new ArrayList<>();
        if (payload == null || !payload.isObject()) {
            return names;
        }
        Iterator<String> iterator = payload.fieldNames();
        while (iterator.hasNext()) {
            names.add(iterator.next());
        }
        return names;
    }
}
