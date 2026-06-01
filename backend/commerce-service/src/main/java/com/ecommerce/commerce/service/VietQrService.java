package com.ecommerce.commerce.service;

import com.ecommerce.commerce.config.VietQrProperties;
import com.ecommerce.commerce.domain.PaymentEntity;
import com.ecommerce.commerce.dto.VietQrBankAppResponse;
import com.ecommerce.commerce.dto.VietQrBankAppsResponse;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class VietQrService {

    private final VietQrProperties properties;
    private final RestClient restClient;

    @Autowired
    public VietQrService(VietQrProperties properties) {
        this(properties, RestClient.builder().build());
    }

    public VietQrService(VietQrProperties properties, RestClient restClient) {
        this.properties = properties;
        this.restClient = restClient;
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

    public VietQrBankAppsResponse bankAppsForPayment(PaymentEntity payment, String platform) {
        List<VietQrBankAppResponse> apps = loadBankAppCatalog(platform).stream()
                .filter(app -> !blank(app.appId()) && !blank(app.appName()))
                .map(app -> new VietQrBankAppResponse(
                        app.appId(),
                        app.appName(),
                        app.bankName(),
                        app.appLogo(),
                        app.monthlyInstall(),
                        buildBankDeepLink(payment, app.appId()),
                        app.autofill()
                ))
                .sorted(Comparator
                        .comparing(VietQrBankAppResponse::autofill).reversed()
                        .thenComparing(app -> Optional.ofNullable(app.monthlyInstall()).orElse(0), Comparator.reverseOrder()))
                .toList();
        return new VietQrBankAppsResponse(apps);
    }

    private List<BankAppCatalogItem> loadBankAppCatalog(String platform) {
        String url = "ios".equalsIgnoreCase(platform)
                ? properties.getIosAppDeeplinksUrl()
                : properties.getAndroidAppDeeplinksUrl();
        try {
            JsonNode payload = restClient.get()
                    .uri(url)
                    .retrieve()
                    .body(JsonNode.class);
            JsonNode apps = payload == null ? null : payload.path("apps");
            if (apps == null || !apps.isArray()) {
                return fallbackBankApps();
            }

            List<BankAppCatalogItem> result = new java.util.ArrayList<>();
            for (JsonNode item : apps) {
                result.add(new BankAppCatalogItem(
                        text(item, "appId"),
                        text(item, "appName"),
                        text(item, "bankName"),
                        text(item, "appLogo"),
                        item.path("monthlyInstall").isNumber() ? item.path("monthlyInstall").asInt() : 0,
                        item.path("autofill").asInt(0) == 1
                ));
            }
            return result.isEmpty() ? fallbackBankApps() : result;
        } catch (RuntimeException exception) {
            log.warn("Failed to fetch VietQR bank app list from {}: {}", url, exception.getMessage());
            return fallbackBankApps();
        }
    }

    private String buildBankDeepLink(PaymentEntity payment, String appId) {
        UriComponentsBuilder builder = UriComponentsBuilder
                .fromUriString(properties.getDeeplinkBaseUrl())
                .queryParam("app", appId);

        String bankAlias = firstNotBlank(payment.getBankCode(), payment.getBankBin(), properties.getBankCode(), properties.getBankBin());
        String accountNo = firstNotBlank(payment.getBankAccountNumber(), properties.getAccountNo());
        if (!blank(accountNo) && !blank(bankAlias)) {
            builder.queryParam("ba", accountNo.trim() + "@" + bankAlias.trim());
        }
        if (payment.getAmount() != null) {
            builder.queryParam("am", payment.getAmount().setScale(0, RoundingMode.HALF_UP).toPlainString());
        }
        builder.queryParam("tn", firstNotBlank(payment.getTransferContent(), payment.getInvoiceNumber()));
        builder.queryParam("bn", firstNotBlank(payment.getAccountName(), properties.getAccountName()));
        if (!blank(properties.getReturnUrl())) {
            builder.queryParam("url", properties.getReturnUrl().trim());
        }

        return builder.build().encode().toUriString();
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

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? "" : value.asText();
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (!blank(value)) {
                return value.trim();
            }
        }
        return "";
    }

    private List<BankAppCatalogItem> fallbackBankApps() {
        return List.of(
                new BankAppCatalogItem("tcb", "Techcombank Mobile", "Ngân hàng TMCP Kỹ thương Việt Nam", null, 200000, false),
                new BankAppCatalogItem("mb", "MB Bank", "Ngân hàng TMCP Quân đội", null, 500000, false),
                new BankAppCatalogItem("vcb", "Vietcombank", "Ngân hàng TMCP Ngoại thương Việt Nam", null, 300000, false),
                new BankAppCatalogItem("bidv", "BIDV SmartBanking", "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam", null, 200000, true),
                new BankAppCatalogItem("icb", "VietinBank iPay", "Ngân hàng TMCP Công thương Việt Nam", null, 200000, true),
                new BankAppCatalogItem("vpb", "VPBank NEO", "Ngân hàng TMCP Việt Nam Thịnh Vượng", null, 200000, false),
                new BankAppCatalogItem("acb", "ACB One", "Ngân hàng TMCP Á Châu", null, 70000, true),
                new BankAppCatalogItem("tpb", "TPBank Mobile", "Ngân hàng TMCP Tiên Phong", null, 80000, false)
        );
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

    private record BankAppCatalogItem(
            String appId,
            String appName,
            String bankName,
            String appLogo,
            Integer monthlyInstall,
            boolean autofill
    ) {
    }
}
