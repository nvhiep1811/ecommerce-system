package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.VietQrProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.RoundingMode;
import java.util.Optional;

@Slf4j
@Service
public class VietQrService {

    private final VietQrProperties properties;

    public VietQrService(VietQrProperties properties) {
        this.properties = properties;
    }

    public Optional<VietQrInstruction> createInstruction(CreatePaymentCommand command) {
        if (!properties.isEnabled()) {
            return Optional.empty();
        }

        if (!hasQrConfig()) {
            log.warn("VietQR quicklink is skipped because bank/account config is incomplete");
            return Optional.empty();
        }

        try {
            String bankId = bankId();
            String qrCodeUrl = UriComponentsBuilder
                    .fromUriString(trimTrailingSlash(properties.getQrBaseUrl()))
                    .pathSegment(bankId + "-" + properties.getAccountNo().trim() + "-" + template() + ".png")
                    .queryParam("amount", amount(command))
                    .queryParam("addInfo", command.invoiceNumber())
                    .queryParam("accountName", properties.getAccountName().trim())
                    .build()
                    .encode()
                    .toUriString();

            String bankDeepLink = buildBankDeepLink(command).orElse(null);
            log.info("Created VietQR quicklink for invoice {}", command.invoiceNumber());
            if (bankDeepLink != null) {
                log.info("Created VietQR bank deeplink for invoice {}", command.invoiceNumber());
            } else {
                log.warn("VietQR bank deeplink is not available for invoice {}; QR/manual transfer remains available", command.invoiceNumber());
            }

            return Optional.of(new VietQrInstruction(
                    qrCodeUrl,
                    null,
                    bankDeepLink,
                    blankToNull(properties.getBankCode()),
                    blankToNull(properties.getBankBin()),
                    properties.getAccountNo().trim(),
                    properties.getAccountName().trim()
            ));
        } catch (RuntimeException exception) {
            log.warn("Failed to create VietQR quicklink for invoice {}: {}", command.invoiceNumber(), exception.getMessage());
            return Optional.empty();
        }
    }

    private boolean hasQrConfig() {
        return !blank(properties.getAccountNo())
                && !blank(properties.getAccountName())
                && (!blank(properties.getBankBin()) || !blank(properties.getBankCode()));
    }

    private Optional<String> buildBankDeepLink(CreatePaymentCommand command) {
        if (!properties.isDeeplinkEnabled()) {
            return Optional.empty();
        }
        if (blank(properties.getDeeplinkAppCode())) {
            log.warn("VietQR deeplink is enabled but deeplink app code is missing");
            return Optional.empty();
        }

        UriComponentsBuilder builder = UriComponentsBuilder
                .fromUriString(properties.getDeeplinkBaseUrl())
                .queryParam("app", properties.getDeeplinkAppCode().trim())
                .queryParam("am", amount(command))
                .queryParam("tn", command.invoiceNumber())
                .queryParam("bn", properties.getAccountName().trim());

        String bankAlias = blank(properties.getBankCode()) ? properties.getBankBin() : properties.getBankCode();
        if (!blank(properties.getAccountNo()) && !blank(bankAlias)) {
            builder.queryParam("ba", properties.getAccountNo().trim() + "@" + bankAlias.trim());
        }
        if (!blank(properties.getReturnUrl())) {
            builder.queryParam("url", properties.getReturnUrl().trim());
        }

        // VietQR.io documents these fields as the expected deeplink contract. Current bank apps may still only
        // open the app without autofilling transfer details, so SePay IPN remains the only payment confirmation.
        return Optional.of(builder.build().encode().toUriString());
    }

    private String bankId() {
        return blank(properties.getBankBin()) ? properties.getBankCode().trim() : properties.getBankBin().trim();
    }

    private String template() {
        return blank(properties.getTemplate()) ? "compact2" : properties.getTemplate().trim();
    }

    private String amount(CreatePaymentCommand command) {
        return command.amount().setScale(0, RoundingMode.HALF_UP).toPlainString();
    }

    private String trimTrailingSlash(String value) {
        return value == null ? "" : value.replaceAll("/+$", "");
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private String blankToNull(String value) {
        return blank(value) ? null : value.trim();
    }

    public record VietQrInstruction(
            String qrCodeUrl,
            String qrContent,
            String bankDeepLink,
            String bankCode,
            String bankBin,
            String accountNo,
            String accountName
    ) {
    }
}
