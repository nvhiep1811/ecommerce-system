package com.ecommerce.commerce.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "flash-sale")
public class FlashSaleProperties {

    private boolean enabled = false;
    private String keyPrefix = "flash-sale";
    private long reservationTtlSeconds = 600;
    private Events events = new Events();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getKeyPrefix() {
        return keyPrefix;
    }

    public void setKeyPrefix(String keyPrefix) {
        this.keyPrefix = keyPrefix;
    }

    public long getReservationTtlSeconds() {
        return reservationTtlSeconds;
    }

    public void setReservationTtlSeconds(long reservationTtlSeconds) {
        this.reservationTtlSeconds = reservationTtlSeconds;
    }

    public Events getEvents() {
        return events;
    }

    public void setEvents(Events events) {
        this.events = events;
    }

    public static class Events {
        private boolean kafkaEnabled = false;
        private String topic = "ecommerce.flash-sale.events";
        private boolean publishRequired = true;
        private long publishTimeoutMs = 800;

        public boolean isKafkaEnabled() {
            return kafkaEnabled;
        }

        public void setKafkaEnabled(boolean kafkaEnabled) {
            this.kafkaEnabled = kafkaEnabled;
        }

        public String getTopic() {
            return topic;
        }

        public void setTopic(String topic) {
            this.topic = topic;
        }

        public boolean isPublishRequired() {
            return publishRequired;
        }

        public void setPublishRequired(boolean publishRequired) {
            this.publishRequired = publishRequired;
        }

        public long getPublishTimeoutMs() {
            return publishTimeoutMs;
        }

        public void setPublishTimeoutMs(long publishTimeoutMs) {
            this.publishTimeoutMs = publishTimeoutMs;
        }
    }
}
