package com.ecommerce.commerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "events.kafka")
public class KafkaEventProperties {

    private boolean enabled = false;
    private String orderEventsTopics = "ecommerce.order.events,ecommerce.ORDER.events";
    private String notificationEmailGroupId = "notification.email.order";

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
}
