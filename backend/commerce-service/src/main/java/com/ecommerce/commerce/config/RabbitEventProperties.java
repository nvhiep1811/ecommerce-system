package com.ecommerce.commerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "events.rabbit")
public class RabbitEventProperties {

    private boolean enabled = true;
    private String exchange = "ecommerce.events";
    private String notificationEmailQueue = "notification.email.order";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getExchange() {
        return exchange;
    }

    public void setExchange(String exchange) {
        this.exchange = exchange;
    }

    public String getNotificationEmailQueue() {
        return notificationEmailQueue;
    }

    public void setNotificationEmailQueue(String notificationEmailQueue) {
        this.notificationEmailQueue = notificationEmailQueue;
    }
}
