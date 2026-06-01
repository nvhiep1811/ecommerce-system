package com.ecommerce.commerce.notification;

import com.ecommerce.commerce.domain.NotificationDeliveryEntity;
import com.ecommerce.commerce.repository.NotificationDeliveryRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationDeliveryServiceTest {

    private final NotificationDeliveryRepository repository = mock(NotificationDeliveryRepository.class);
    private final NotificationDeliveryService service = new NotificationDeliveryService(repository);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void claimShouldCreateProcessingDeliveryForNewEvent() {
        when(repository.findByEventIdAndConsumerName("event-1", NotificationDeliveryService.ORDER_EMAIL_CONSUMER))
                .thenReturn(Optional.empty());

        NotificationDeliveryService.DeliveryClaim claim = service.claim(
                "event-1",
                NotificationDeliveryService.ORDER_EMAIL_CONSUMER,
                objectMapper.createObjectNode().put("eventType", "ORDER_PAID").put("orderCode", "ORD-1"),
                "buyer@example.com"
        );

        assertThat(claim.shouldProcess()).isTrue();
        verify(repository).saveAndFlush(any(NotificationDeliveryEntity.class));
    }

    @Test
    void claimShouldSkipAlreadySentEvent() {
        NotificationDeliveryEntity existing = new NotificationDeliveryEntity();
        existing.setEventId("event-1");
        existing.setConsumerName(NotificationDeliveryService.ORDER_EMAIL_CONSUMER);
        existing.setStatus("sent");
        existing.setAttemptCount(1);

        when(repository.findByEventIdAndConsumerName("event-1", NotificationDeliveryService.ORDER_EMAIL_CONSUMER))
                .thenReturn(Optional.of(existing));

        NotificationDeliveryService.DeliveryClaim claim = service.claim(
                "event-1",
                NotificationDeliveryService.ORDER_EMAIL_CONSUMER,
                objectMapper.createObjectNode(),
                "buyer@example.com"
        );

        assertThat(claim.shouldProcess()).isFalse();
        verify(repository, never()).saveAndFlush(any(NotificationDeliveryEntity.class));
    }

    @Test
    void claimShouldRetryFailedEvent() {
        NotificationDeliveryEntity existing = new NotificationDeliveryEntity();
        existing.setEventId("event-1");
        existing.setConsumerName(NotificationDeliveryService.ORDER_EMAIL_CONSUMER);
        existing.setStatus("failed");
        existing.setAttemptCount(1);
        existing.setLastError("SMTP timeout");

        when(repository.findByEventIdAndConsumerName("event-1", NotificationDeliveryService.ORDER_EMAIL_CONSUMER))
                .thenReturn(Optional.of(existing));

        NotificationDeliveryService.DeliveryClaim claim = service.claim(
                "event-1",
                NotificationDeliveryService.ORDER_EMAIL_CONSUMER,
                objectMapper.createObjectNode(),
                "buyer@example.com"
        );

        assertThat(claim.shouldProcess()).isTrue();
        assertThat(existing.getStatus()).isEqualTo("processing");
        assertThat(existing.getAttemptCount()).isEqualTo(2);
        assertThat(existing.getLastError()).isNull();
        verify(repository).saveAndFlush(existing);
    }
}
