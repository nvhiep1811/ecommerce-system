package com.ecommerce.commerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "payment")
public class PaymentProperties {

    private final Methods methods = new Methods();

    public Methods getMethods() {
        return methods;
    }

    public static class Methods {
        private boolean codEnabled = true;

        public boolean isCodEnabled() {
            return codEnabled;
        }

        public void setCodEnabled(boolean codEnabled) {
            this.codEnabled = codEnabled;
        }
    }
}
