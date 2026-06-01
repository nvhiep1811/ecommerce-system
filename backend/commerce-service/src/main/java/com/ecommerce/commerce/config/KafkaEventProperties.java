package com.ecommerce.commerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "events.kafka")
public class KafkaEventProperties {

    private boolean enabled = true;
    private String orderEventsTopics = "ecommerce.order.events,ecommerce.ORDER.events";
    private String notificationEmailGroupId = "notification.email.order";
    private int listenerConcurrency = 1;
    private long retryBackoffMs = 1000;
    private long retryMaxAttempts = 3;
    private String deadLetterTopicSuffix = ".DLT";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getOrderEventsTopics() {
        return orderEventsTopics;
    }

    public void setOrderEventsTopics(String orderEventsTopics) {
        this.orderEventsTopics = orderEventsTopics;
    }

    public String getNotificationEmailGroupId() {
        return notificationEmailGroupId;
    }

    public void setNotificationEmailGroupId(String notificationEmailGroupId) {
        this.notificationEmailGroupId = notificationEmailGroupId;
    }

    public int getListenerConcurrency() {
        return listenerConcurrency;
    }

    public void setListenerConcurrency(int listenerConcurrency) {
        this.listenerConcurrency = listenerConcurrency;
    }

    public long getRetryBackoffMs() {
        return retryBackoffMs;
    }

    public void setRetryBackoffMs(long retryBackoffMs) {
        this.retryBackoffMs = retryBackoffMs;
    }

    public long getRetryMaxAttempts() {
        return retryMaxAttempts;
    }

    public void setRetryMaxAttempts(long retryMaxAttempts) {
        this.retryMaxAttempts = retryMaxAttempts;
    }

    public String getDeadLetterTopicSuffix() {
        return deadLetterTopicSuffix;
    }

    public void setDeadLetterTopicSuffix(String deadLetterTopicSuffix) {
        this.deadLetterTopicSuffix = deadLetterTopicSuffix;
    }
}
