package com.ecommerce.gateway;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "gateway.rate-limit")
public class GatewayRateLimitProperties {

    private boolean enabled;
    private String store = "auto";
    private int requestsPerMinute = 120;
    private boolean includePathInKey = true;
    private List<String> excludedPrefixes = new ArrayList<>();
    private boolean authEnabled = true;
    private int authRequestsPerMinute = 30;
    private List<String> authPrefixes = new ArrayList<>(List.of("/api/auth"));

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getStore() {
        return store;
    }

    public void setStore(String store) {
        this.store = store;
    }

    public int getRequestsPerMinute() {
        return requestsPerMinute;
    }

    public void setRequestsPerMinute(int requestsPerMinute) {
        this.requestsPerMinute = requestsPerMinute;
    }

    public boolean isIncludePathInKey() {
        return includePathInKey;
    }

    public void setIncludePathInKey(boolean includePathInKey) {
        this.includePathInKey = includePathInKey;
    }

    public List<String> getExcludedPrefixes() {
        return excludedPrefixes;
    }

    public void setExcludedPrefixes(List<String> excludedPrefixes) {
        this.excludedPrefixes = excludedPrefixes == null ? new ArrayList<>() : excludedPrefixes;
    }

    public boolean isAuthEnabled() {
        return authEnabled;
    }

    public void setAuthEnabled(boolean authEnabled) {
        this.authEnabled = authEnabled;
    }

    public int getAuthRequestsPerMinute() {
        return authRequestsPerMinute;
    }

    public void setAuthRequestsPerMinute(int authRequestsPerMinute) {
        this.authRequestsPerMinute = authRequestsPerMinute;
    }

    public List<String> getAuthPrefixes() {
        return authPrefixes;
    }

    public void setAuthPrefixes(List<String> authPrefixes) {
        this.authPrefixes = authPrefixes == null ? new ArrayList<>() : authPrefixes;
    }
}
