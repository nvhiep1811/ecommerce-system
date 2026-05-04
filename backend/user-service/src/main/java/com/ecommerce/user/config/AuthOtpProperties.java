package com.ecommerce.user.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "auth.otp")
public class AuthOtpProperties {

    private boolean enabled = true;
    private boolean registerRequired = true;
    private int length = 6;
    private int ttlMinutes = 10;
    private int resetTokenTtlMinutes = 10;
    private int resendCooldownSeconds = 60;
    private int maxAttempts = 5;
    private String secret = "please-change-this-otp-secret";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isRegisterRequired() {
        return registerRequired;
    }

    public void setRegisterRequired(boolean registerRequired) {
        this.registerRequired = registerRequired;
    }

    public int getLength() {
        return length;
    }

    public void setLength(int length) {
        this.length = length;
    }

    public int getTtlMinutes() {
        return ttlMinutes;
    }

    public void setTtlMinutes(int ttlMinutes) {
        this.ttlMinutes = ttlMinutes;
    }

    public int getResetTokenTtlMinutes() {
        return resetTokenTtlMinutes;
    }

    public void setResetTokenTtlMinutes(int resetTokenTtlMinutes) {
        this.resetTokenTtlMinutes = resetTokenTtlMinutes;
    }

    public int getResendCooldownSeconds() {
        return resendCooldownSeconds;
    }

    public void setResendCooldownSeconds(int resendCooldownSeconds) {
        this.resendCooldownSeconds = resendCooldownSeconds;
    }

    public int getMaxAttempts() {
        return maxAttempts;
    }

    public void setMaxAttempts(int maxAttempts) {
        this.maxAttempts = maxAttempts;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }
}
