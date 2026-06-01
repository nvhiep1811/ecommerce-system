package com.ecommerce.commerce.dto;

public record VietQrBankAppResponse(
        String appId,
        String appName,
        String bankName,
        String appLogo,
        Integer monthlyInstall,
        String deeplink,
        boolean autofill
) {
}
