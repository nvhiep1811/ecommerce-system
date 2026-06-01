package com.ecommerce.commerce.service;

import com.ecommerce.commerce.events.OutboxKafkaMessageExtractor;
import com.ecommerce.commerce.observability.CommerceBusinessMetrics;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class PaymentExpirationKafkaConsumerTest {

    private final PaymentExpirationDelayQueue delayQueue = mock(PaymentExpirationDelayQueue.class);
    private final CommerceBusinessMetrics businessMetrics = mock(CommerceBusinessMetrics.class);
    private final PaymentExpirationKafkaConsumer consumer = new PaymentExpirationKafkaConsumer(
            delayQueue,
            new OutboxKafkaMessageExtractor(new ObjectMapper()),
            businessMetrics
    );

    @Test
    void shouldSchedulePaymentExpirationFromPendingPaymentEvent() {
        consumer.handle(new ConsumerRecord<>(
                "ecommerce.order.events",
                0,
                1L,
                "ORD-1",
                """
                {
                  "eventType": "ORDER_PAYMENT_PENDING",
                  "paymentId": 10,
                  "expiredAt": "2026-05-24T15:00:00Z"
                }
                """
        ));

        verify(delayQueue).schedule(10L, OffsetDateTime.parse("2026-05-24T15:00:00Z"));
    }

    @Test
    void shouldSchedulePaymentExpirationFromRawDebeziumEnvelope() {
        consumer.handle(new ConsumerRecord<>(
                "ecommerce.ORDER.events",
                0,
                2L,
                "ORD-2",
                """
                {
                  "payload": {
                    "after": {
                      "id": 23,
                      "aggregate_type": "ORDER",
                      "aggregate_id": "2",
                      "event_type": "ORDER_PAYMENT_PENDING",
                      "payload": {
                        "paymentId": 11,
                        "expiredAt": "2026-05-24T16:00:00Z"
                      }
                    }
                  }
                }
                """
        ));

        verify(delayQueue).schedule(11L, OffsetDateTime.parse("2026-05-24T16:00:00Z"));
    }

    @Test
    void shouldIgnoreNonPaymentPendingOrderEvents() {
        consumer.handle(new ConsumerRecord<>(
                "ecommerce.order.events",
                0,
                3L,
                "ORD-3",
                """
                {
                  "eventType": "ORDER_PAID",
                  "paymentId": 12,
                  "expiredAt": "2026-05-24T17:00:00Z"
                }
                """
        ));

        verify(delayQueue, never()).schedule(12L, OffsetDateTime.parse("2026-05-24T17:00:00Z"));
    }

    @Test
    void shouldThrowForInvalidPendingPaymentEvent() {
        assertThrows(IllegalStateException.class, () -> consumer.handle(new ConsumerRecord<>(
                "ecommerce.order.events",
                0,
                4L,
                "ORD-4",
                """
                {
                  "eventType": "ORDER_PAYMENT_PENDING",
                  "paymentId": 13
                }
                """
        )));
    }
}
