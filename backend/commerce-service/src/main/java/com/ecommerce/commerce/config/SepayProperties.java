package com.ecommerce.commerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "sepay")
public class SepayProperties {

    private boolean enabled = true;
    private String merchantId = "";
    private String secretKey = "";
    private String checkoutEndpoint = "https://pay.sepay.vn/v1/checkout/init";
    private String qrEndpoint = "https://qr.sepay.vn/img";
    private String successUrl = "";
    private String cancelUrl = "";
    private String errorUrl = "";
    private String webhookSecret = "";
    private int paymentExpireMinutes = 15;
    private String bankName = "";
    private String bankAccountNumber = "";
    private String accountName = "";
    private String bankDeepLink = "";
    private String publicBaseUrl = "http://localhost:8080/api";
    private final Methods methods = new Methods();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getMerchantId() {
        return merchantId;
    }

    public void setMerchantId(String merchantId) {
        this.merchantId = merchantId;
    }

    public String getSecretKey() {
        return secretKey;
    }

    public void setSecretKey(String secretKey) {
        this.secretKey = secretKey;
    }

    public String getCheckoutEndpoint() {
        return checkoutEndpoint;
    }

    public void setCheckoutEndpoint(String checkoutEndpoint) {
        this.checkoutEndpoint = checkoutEndpoint;
    }

    public String getQrEndpoint() {
        return qrEndpoint;
    }

    public void setQrEndpoint(String qrEndpoint) {
        this.qrEndpoint = qrEndpoint;
    }

    public String getSuccessUrl() {
        return successUrl;
    }

    public void setSuccessUrl(String successUrl) {
        this.successUrl = successUrl;
    }

    public String getCancelUrl() {
        return cancelUrl;
    }

    public void setCancelUrl(String cancelUrl) {
        this.cancelUrl = cancelUrl;
    }

    public String getErrorUrl() {
        return errorUrl;
    }

    public void setErrorUrl(String errorUrl) {
        this.errorUrl = errorUrl;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }

    public int getPaymentExpireMinutes() {
        return paymentExpireMinutes;
    }

    public void setPaymentExpireMinutes(int paymentExpireMinutes) {
        this.paymentExpireMinutes = paymentExpireMinutes;
    }

    public String getBankName() {
        return bankName;
    }

    public void setBankName(String bankName) {
        this.bankName = bankName;
    }

    public String getBankAccountNumber() {
        return bankAccountNumber;
    }

    public void setBankAccountNumber(String bankAccountNumber) {
        this.bankAccountNumber = bankAccountNumber;
    }

    public String getAccountName() {
        return accountName;
    }

    public void setAccountName(String accountName) {
        this.accountName = accountName;
    }

    public String getBankDeepLink() {
        return bankDeepLink;
    }

    public void setBankDeepLink(String bankDeepLink) {
        this.bankDeepLink = bankDeepLink;
    }

    public String getPublicBaseUrl() {
        return publicBaseUrl;
    }

    public void setPublicBaseUrl(String publicBaseUrl) {
        this.publicBaseUrl = publicBaseUrl;
    }

    public Methods getMethods() {
        return methods;
    }

    public static class Methods {
        private boolean qrEnabled = true;
        private boolean checkoutEnabled = true;
        private boolean cardEnabled = true;
        private boolean applePayEnabled = false;
        private boolean googlePayEnabled = false;

        public boolean isQrEnabled() {
            return qrEnabled;
        }

        public void setQrEnabled(boolean qrEnabled) {
            this.qrEnabled = qrEnabled;
        }

        public boolean isCheckoutEnabled() {
            return checkoutEnabled;
        }

        public void setCheckoutEnabled(boolean checkoutEnabled) {
            this.checkoutEnabled = checkoutEnabled;
        }

        public boolean isCardEnabled() {
            return cardEnabled;
        }

        public void setCardEnabled(boolean cardEnabled) {
            this.cardEnabled = cardEnabled;
        }

        public boolean isApplePayEnabled() {
            return applePayEnabled;
        }

        public void setApplePayEnabled(boolean applePayEnabled) {
            this.applePayEnabled = applePayEnabled;
        }

        public boolean isGooglePayEnabled() {
            return googlePayEnabled;
        }

        public void setGooglePayEnabled(boolean googlePayEnabled) {
            this.googlePayEnabled = googlePayEnabled;
        }
    }
}
