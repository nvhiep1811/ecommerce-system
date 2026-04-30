package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.SepayProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
public class SepayPaymentGateway implements PaymentGateway {

    private static final String HMAC_SHA256 = "HmacSHA256";

    private final SepayProperties properties;
    private final VietQrService vietQrService;
    private final ObjectMapper objectMapper;

    public SepayPaymentGateway(SepayProperties properties, VietQrService vietQrService, ObjectMapper objectMapper) {
        this.properties = properties;
        this.vietQrService = vietQrService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean supports(String paymentMethodCode) {
        return PaymentConstants.METHOD_SEPAY_QR.equalsIgnoreCase(paymentMethodCode)
                || PaymentConstants.METHOD_SEPAY_CHECKOUT.equalsIgnoreCase(paymentMethodCode)
                || PaymentConstants.METHOD_SEPAY_CARD.equalsIgnoreCase(paymentMethodCode);
    }

    @Override
    public String provider() {
        return PaymentConstants.PROVIDER_SEPAY;
    }

    @Override
    public CreatePaymentResult createPayment(CreatePaymentCommand command) {
        if (PaymentConstants.METHOD_SEPAY_QR.equalsIgnoreCase(command.method())) {
            return createQrInstruction(command);
        }
        return createCheckoutInstruction(command);
    }

    public Map<String, String> checkoutFields(CreatePaymentCommand command) {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("order_amount", toSepayAmount(command));
        fields.put("merchant", properties.getMerchantId());
        fields.put("currency", command.currency());
        fields.put("operation", "PURCHASE");
        fields.put("order_description", "Thanh toan don hang " + command.orderNo());
        fields.put("order_invoice_number", command.invoiceNumber());
        fields.put("customer_id", command.userId().toString());
        if (PaymentConstants.METHOD_SEPAY_CARD.equalsIgnoreCase(command.method())) {
            fields.put("payment_method", "CARD");
        }
        putIfNotBlank(fields, "success_url", properties.getSuccessUrl());
        putIfNotBlank(fields, "error_url", properties.getErrorUrl());
        putIfNotBlank(fields, "cancel_url", properties.getCancelUrl());
        fields.put("signature", sign(fields));
        return fields;
    }

    private CreatePaymentResult createQrInstruction(CreatePaymentCommand command) {
        String transferContent = command.invoiceNumber();
        Optional<VietQrService.VietQrInstruction> vietQrInstruction = vietQrService.createInstruction(command);
        String fallbackQrCodeUrl = UriComponentsBuilder.fromUriString(properties.getQrEndpoint())
                .queryParam("acc", properties.getBankAccountNumber())
                .queryParam("bank", properties.getBankName())
                .queryParam("amount", toSepayAmount(command))
                .queryParam("des", transferContent)
                .build()
                .encode()
                .toUriString();
        String qrCodeUrl = vietQrInstruction
                .map(VietQrService.VietQrInstruction::qrCodeUrl)
                .orElse(fallbackQrCodeUrl);
        String bankDeepLink = vietQrInstruction
                .map(VietQrService.VietQrInstruction::bankDeepLink)
                .orElse(blankToNull(properties.getBankDeepLink()));
        String bankCode = vietQrInstruction
                .map(VietQrService.VietQrInstruction::bankCode)
                .orElse(null);
        String bankBin = vietQrInstruction
                .map(VietQrService.VietQrInstruction::bankBin)
                .orElse(null);
        String bankAccountNumber = vietQrInstruction
                .map(VietQrService.VietQrInstruction::accountNo)
                .orElse(properties.getBankAccountNumber());
        String accountName = vietQrInstruction
                .map(VietQrService.VietQrInstruction::accountName)
                .orElse(properties.getAccountName());

        if (vietQrInstruction.isPresent()) {
            log.info("Using VietQR quicklink for SePay QR invoice {}", command.invoiceNumber());
        } else {
            log.warn("Using SePay/manual QR fallback for invoice {}; VietQR quicklink was not available", command.invoiceNumber());
        }
        if (bankDeepLink == null) {
            log.warn("No bank deeplink returned for invoice {}; QR/manual transfer remains available", command.invoiceNumber());
        }

        Map<String, Object> rawRequest = Map.of(
                "qrEndpoint", properties.getQrEndpoint(),
                "bank", properties.getBankName(),
                "bankCode", bankCode == null ? "" : bankCode,
                "bankBin", bankBin == null ? "" : bankBin,
                "accountNumber", bankAccountNumber,
                "amount", toSepayAmount(command),
                "description", transferContent,
                "qrProvider", vietQrInstruction.isPresent() ? "VIETQR_IO" : "SEPAY_FALLBACK"
        );

        return new CreatePaymentResult(
                provider(),
                command.invoiceNumber(),
                null,
                qrCodeUrl,
                null,
                vietQrInstruction.map(VietQrService.VietQrInstruction::qrContent).orElse(null),
                bankDeepLink,
                properties.getBankName(),
                bankCode,
                bankBin,
                bankAccountNumber,
                accountName,
                transferContent,
                objectMapper.valueToTree(rawRequest),
                objectMapper.valueToTree(Map.of("mode", "SEPAY_QR_IMAGE_URL")),
                "SePay QR payment initialized"
        );
    }

    private CreatePaymentResult createCheckoutInstruction(CreatePaymentCommand command) {
        Map<String, String> fields = checkoutFields(command);
        return new CreatePaymentResult(
                provider(),
                command.invoiceNumber(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                command.invoiceNumber(),
                objectMapper.valueToTree(fields),
                objectMapper.valueToTree(Map.of("mode", "SEPAY_CHECKOUT_FORM")),
                "SePay checkout initialized"
        );
    }

    public String checkoutUrl(Long paymentId) {
        return properties.getPublicBaseUrl().replaceAll("/+$", "")
                + "/payments/" + paymentId + "/sepay-checkout";
    }

    public String checkoutEndpoint() {
        return properties.getCheckoutEndpoint();
    }

    private String sign(Map<String, String> fields) {
        if (properties.getSecretKey() == null || properties.getSecretKey().isBlank()) {
            return "";
        }
        String signedString = fields.entrySet().stream()
                .filter(entry -> !"signature".equals(entry.getKey()))
                .filter(entry -> entry.getValue() != null && !entry.getValue().isBlank())
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .reduce((left, right) -> left + "," + right)
                .orElse("");
        try {
            Mac mac = Mac.getInstance(HMAC_SHA256);
            mac.init(new SecretKeySpec(properties.getSecretKey().getBytes(StandardCharsets.UTF_8), HMAC_SHA256));
            return Base64.getEncoder().encodeToString(mac.doFinal(signedString.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to sign SePay checkout request", exception);
        }
    }

    private String toSepayAmount(CreatePaymentCommand command) {
        return command.amount().setScale(0, RoundingMode.HALF_UP).toPlainString();
    }

    private void putIfNotBlank(Map<String, String> fields, String key, String value) {
        if (value != null && !value.isBlank()) {
            fields.put(key, value);
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
