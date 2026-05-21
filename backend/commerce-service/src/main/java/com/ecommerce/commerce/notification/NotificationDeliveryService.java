package com.ecommerce.commerce.notification;

import com.ecommerce.commerce.domain.NotificationDeliveryEntity;
import com.ecommerce.commerce.repository.NotificationDeliveryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Locale;

@Slf4j
@Service
public class NotificationDeliveryService {

    public static final String ORDER_EMAIL_CONSUMER = "order-email";

    private static final String STATUS_PROCESSING = "processing";
    private static final String STATUS_SENT = "sent";
    private static final String STATUS_SKIPPED = "skipped";
    private static final String STATUS_FAILED = "failed";
    private static final Duration PROCESSING_TIMEOUT = Duration.ofMinutes(15);

    private final NotificationDeliveryRepository repository;

    public NotificationDeliveryService(NotificationDeliveryRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public DeliveryClaim claim(String eventId, String consumerName, JsonNode payload, String recipientEmail) {
        if (eventId == null || eventId.isBlank()) {
            log.warn("Notification event has no id; processing without duplicate protection");
            return DeliveryClaim.processUntracked();
        }

        return repository.findByEventIdAndConsumerName(eventId, consumerName)
                .map(existing -> claimExisting(existing, payload, recipientEmail))
                .orElseGet(() -> claimNew(eventId, consumerName, payload, recipientEmail));
    }

    @Transactional
    public void markSent(String eventId, String consumerName) {
        updateTerminalStatus(eventId, consumerName, STATUS_SENT, null);
    }

    @Transactional
    public void markSkipped(String eventId, String consumerName, String reason) {
        updateTerminalStatus(eventId, consumerName, STATUS_SKIPPED, reason);
    }

    @Transactional
    public void markFailed(String eventId, String consumerName, Exception exception) {
        if (eventId == null || eventId.isBlank()) {
            return;
        }
        repository.findByEventIdAndConsumerName(eventId, consumerName).ifPresent(delivery -> {
            delivery.setStatus(STATUS_FAILED);
            delivery.setLastError(truncate(exception.getMessage(), 1000));
            repository.save(delivery);
        });
    }

    private DeliveryClaim claimExisting(NotificationDeliveryEntity existing, JsonNode payload, String recipientEmail) {
        String status = normalize(existing.getStatus());
        if (STATUS_SENT.equals(status) || STATUS_SKIPPED.equals(status)) {
            return DeliveryClaim.duplicate(existing.getEventId(), status);
        }
        if (STATUS_PROCESSING.equals(status) && !isStale(existing)) {
            return DeliveryClaim.duplicate(existing.getEventId(), status);
        }

        existing.setStatus(STATUS_PROCESSING);
        existing.setAttemptCount((existing.getAttemptCount() == null ? 0 : existing.getAttemptCount()) + 1);
        existing.setPayload(payload);
        existing.setRecipientEmail(recipientEmail);
        existing.setLastError(null);
        existing.setProcessedAt(null);
        repository.saveAndFlush(existing);
        return DeliveryClaim.process(existing.getEventId());
    }

    private boolean isStale(NotificationDeliveryEntity existing) {
        OffsetDateTime updatedAt = existing.getUpdatedAt();
        return updatedAt == null || updatedAt.plus(PROCESSING_TIMEOUT).isBefore(OffsetDateTime.now());
    }

    private DeliveryClaim claimNew(String eventId, String consumerName, JsonNode payload, String recipientEmail) {
        NotificationDeliveryEntity delivery = new NotificationDeliveryEntity();
        delivery.setEventId(eventId);
        delivery.setConsumerName(consumerName);
        delivery.setEventType(text(payload, "eventType"));
        delivery.setAggregateType(text(payload, "aggregateType"));
        delivery.setAggregateId(firstNotBlank(text(payload, "aggregateId"), text(payload, "orderId"), text(payload, "orderCode")));
        delivery.setRecipientEmail(recipientEmail);
        delivery.setStatus(STATUS_PROCESSING);
        delivery.setAttemptCount(1);
        delivery.setPayload(payload);
        try {
            repository.saveAndFlush(delivery);
            return DeliveryClaim.process(eventId);
        } catch (DataIntegrityViolationException exception) {
            log.info("Skip duplicate notification event {} for consumer {}", eventId, consumerName);
            return DeliveryClaim.duplicate(eventId, "duplicate");
        }
    }

    private void updateTerminalStatus(String eventId, String consumerName, String status, String reason) {
        if (eventId == null || eventId.isBlank()) {
            return;
        }
        repository.findByEventIdAndConsumerName(eventId, consumerName).ifPresent(delivery -> {
            delivery.setStatus(status);
            delivery.setProcessedAt(OffsetDateTime.now());
            delivery.setLastError(truncate(reason, 1000));
            repository.save(delivery);
        });
    }

    private String normalize(String status) {
        return status == null ? "" : status.trim().toLowerCase(Locale.ROOT);
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? "" : value.asText();
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    public record DeliveryClaim(boolean shouldProcess, boolean tracked, String eventId, String reason) {

        static DeliveryClaim process(String eventId) {
            return new DeliveryClaim(true, true, eventId, "claimed");
        }

        static DeliveryClaim processUntracked() {
            return new DeliveryClaim(true, false, "", "untracked");
        }

        static DeliveryClaim duplicate(String eventId, String reason) {
            return new DeliveryClaim(false, true, eventId, reason);
        }
    }
}
