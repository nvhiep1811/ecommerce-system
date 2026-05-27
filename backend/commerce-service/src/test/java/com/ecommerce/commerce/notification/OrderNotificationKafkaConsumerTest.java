package com.ecommerce.commerce.notification;

import com.ecommerce.commerce.events.OutboxKafkaMessageExtractor;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderNotificationKafkaConsumerTest {

    private final MailService mailService = mock(MailService.class);
    private final NotificationDeliveryService deliveryService = mock(NotificationDeliveryService.class);
    private final OrderNotificationConsumer delegate = new OrderNotificationConsumer(mailService, deliveryService);
    private final OrderNotificationKafkaConsumer consumer = new OrderNotificationKafkaConsumer(
            delegate,
            new OutboxKafkaMessageExtractor(new ObjectMapper())
    );

    @Test
    void kafkaConsumerShouldHandleDirectOrderEventPayload() {
        when(deliveryService.claim(anyString(), eq(NotificationDeliveryService.ORDER_EMAIL_CONSUMER), any(), anyString()))
                .thenReturn(NotificationDeliveryService.DeliveryClaim.process("event-1"));

        consumer.handle(new ConsumerRecord<>(
                "ecommerce.order.events",
                0,
                1L,
                "ORD-1",
                """
                {
                  "eventId": "event-1",
                  "eventType": "ORDER_CREATED",
                  "orderCode": "ORD-1",
                  "userEmail": "buyer@example.com",
                  "customerName": "Nguyen Van A",
                  "totalAmount": 1500000,
                  "paymentMethod": "COD",
                  "paymentStatus": "pending",
                  "orderStatus": "pending"
                }
                """
        ));

        verify(mailService).send(
                eq("buyer@example.com"),
                contains("ORD-1"),
                contains("Thanh toán khi nhận hàng")
        );
    }

    @Test
    void kafkaConsumerShouldHandleRawDebeziumOutboxPayload() {
        when(deliveryService.claim(anyString(), eq(NotificationDeliveryService.ORDER_EMAIL_CONSUMER), any(), anyString()))
                .thenReturn(NotificationDeliveryService.DeliveryClaim.process("23"));

        consumer.handle(new ConsumerRecord<>(
                "ecommerce.order.events",
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
                      "event_type": "ORDER_PAID",
                      "payload": {
                        "orderCode": "ORD-2",
                        "userEmail": "buyer@example.com",
                        "customerName": "Nguyen Van A",
                        "totalAmount": 1500000,
                        "paymentMethod": "SEPAY_QR",
                        "paymentStatus": "paid",
                        "orderStatus": "paid"
                      }
                    }
                  }
                }
                """
        ));

        verify(mailService).send(
                eq("buyer@example.com"),
                contains("Thanh toán thành công"),
                contains("xác nhận thanh toán")
        );
    }

    @Test
    void kafkaConsumerShouldThrowWhenPayloadCannotBeParsed() {
        assertThrows(IllegalStateException.class, () -> consumer.handle(new ConsumerRecord<>(
                "ecommerce.order.events",
                0,
                3L,
                "ORD-3",
                "{not-json"
        )));
    }
}
