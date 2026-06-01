package com.ecommerce.commerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "vietqr")
public class VietQrProperties {

    private boolean enabled = true;
    private String qrBaseUrl = "https://img.vietqr.io/image";
    private String deeplinkBaseUrl = "https://dl.vietqr.io/pay";
    private String androidAppDeeplinksUrl = "https://api.vietqr.io/v2/android-app-deeplinks";
    private String iosAppDeeplinksUrl = "https://api.vietqr.io/v2/ios-app-deeplinks";
    private String bankBin = "";
    private String bankCode = "";
    private String accountNo = "";
    private String accountName = "";
    private String template = "compact2";
    private boolean deeplinkEnabled = false;
    private String deeplinkAppCode = "";
    private String returnUrl = "";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getQrBaseUrl() {
        return qrBaseUrl;
    }

    public void setQrBaseUrl(String qrBaseUrl) {
        this.qrBaseUrl = qrBaseUrl;
    }

    public String getDeeplinkBaseUrl() {
        return deeplinkBaseUrl;
    }

    public void setDeeplinkBaseUrl(String deeplinkBaseUrl) {
        this.deeplinkBaseUrl = deeplinkBaseUrl;
    }

    public String getAndroidAppDeeplinksUrl() {
        return androidAppDeeplinksUrl;
    }

    public void setAndroidAppDeeplinksUrl(String androidAppDeeplinksUrl) {
        this.androidAppDeeplinksUrl = androidAppDeeplinksUrl;
    }

    public String getIosAppDeeplinksUrl() {
        return iosAppDeeplinksUrl;
    }

    public void setIosAppDeeplinksUrl(String iosAppDeeplinksUrl) {
        this.iosAppDeeplinksUrl = iosAppDeeplinksUrl;
    }

    public String getBankBin() {
        return bankBin;
    }

    public void setBankBin(String bankBin) {
        this.bankBin = bankBin;
    }

    public String getBankCode() {
        return bankCode;
    }

    public void setBankCode(String bankCode) {
        this.bankCode = bankCode;
    }

    public String getAccountNo() {
        return accountNo;
    }

    public void setAccountNo(String accountNo) {
        this.accountNo = accountNo;
    }

    public String getAccountName() {
        return accountName;
    }

    public void setAccountName(String accountName) {
        this.accountName = accountName;
    }

    public String getTemplate() {
        return template;
    }

    public void setTemplate(String template) {
        this.template = template;
    }

    public boolean isDeeplinkEnabled() {
        return deeplinkEnabled;
    }

    public void setDeeplinkEnabled(boolean deeplinkEnabled) {
        this.deeplinkEnabled = deeplinkEnabled;
    }

    public String getDeeplinkAppCode() {
        return deeplinkAppCode;
    }

    public void setDeeplinkAppCode(String deeplinkAppCode) {
        this.deeplinkAppCode = deeplinkAppCode;
    }

    public String getReturnUrl() {
        return returnUrl;
    }

    public void setReturnUrl(String returnUrl) {
        this.returnUrl = returnUrl;
    }
}
