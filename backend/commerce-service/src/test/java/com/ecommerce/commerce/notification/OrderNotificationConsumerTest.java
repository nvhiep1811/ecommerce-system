package com.ecommerce.commerce.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderNotificationConsumerTest {

    private final MailService mailService = mock(MailService.class);
    private final NotificationDeliveryService deliveryService = mock(NotificationDeliveryService.class);
    private final OrderNotificationConsumer consumer = new OrderNotificationConsumer(mailService, deliveryService);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void notificationConsumerShouldSendOrderCreatedEmail() {
        when(deliveryService.claim(anyString(), eq(NotificationDeliveryService.ORDER_EMAIL_CONSUMER), any(), anyString()))
                .thenReturn(NotificationDeliveryService.DeliveryClaim.process("event-1"));

        consumer.handle(objectMapper.valueToTree(new EventPayload(
                "event-1",
                "ORDER_CREATED",
                "ORD-1",
                "buyer@example.com",
                "Nguyen Van A",
                new BigDecimal("1500000"),
                "COD",
                "pending",
                "pending"
        )));

        verify(mailService).send(
                eq("buyer@example.com"),
                contains("ORD-1"),
                contains("Thanh toán khi nhận hàng")
        );
        verify(deliveryService).markSent("event-1", NotificationDeliveryService.ORDER_EMAIL_CONSUMER);
    }

    @Test
    void notificationConsumerShouldSendOrderPaidEmail() {
        when(deliveryService.claim(anyString(), eq(NotificationDeliveryService.ORDER_EMAIL_CONSUMER), any(), anyString()))
                .thenReturn(NotificationDeliveryService.DeliveryClaim.process("event-2"));

        consumer.handle(objectMapper.valueToTree(new EventPayload(
                "event-2",
                "ORDER_PAID",
                "ORD-1",
                "buyer@example.com",
                "Nguyen Van A",
                new BigDecimal("1500000"),
                "SEPAY_QR",
                "paid",
                "paid"
        )));

        verify(mailService).send(
                eq("buyer@example.com"),
                contains("Thanh toán thành công"),
                contains("xác nhận thanh toán")
        );
        verify(deliveryService).markSent("event-2", NotificationDeliveryService.ORDER_EMAIL_CONSUMER);
    }

    @Test
    void notificationConsumerShouldSkipDuplicateEvent() {
        when(deliveryService.claim(anyString(), eq(NotificationDeliveryService.ORDER_EMAIL_CONSUMER), any(), anyString()))
                .thenReturn(NotificationDeliveryService.DeliveryClaim.duplicate("event-3", "sent"));

        consumer.handle(objectMapper.valueToTree(new EventPayload(
                "event-3",
                "ORDER_PAID",
                "ORD-1",
                "buyer@example.com",
                "Nguyen Van A",
                new BigDecimal("1500000"),
                "SEPAY_QR",
                "paid",
                "paid"
        )));

        verify(mailService, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    void notificationConsumerShouldMarkFailedAndPropagateProcessingErrors() {
        when(deliveryService.claim(anyString(), eq(NotificationDeliveryService.ORDER_EMAIL_CONSUMER), any(), anyString()))
                .thenReturn(NotificationDeliveryService.DeliveryClaim.process("event-4"));
        doThrow(new IllegalStateException("SMTP down"))
                .when(mailService)
                .send(anyString(), anyString(), anyString());

        assertThrows(IllegalStateException.class, () -> consumer.handle(objectMapper.valueToTree(new EventPayload(
                "event-4",
                "ORDER_PAID",
                "ORD-1",
                "buyer@example.com",
                "Nguyen Van A",
                new BigDecimal("1500000"),
                "SEPAY_QR",
                "paid",
                "paid"
        ))));

        verify(deliveryService).markFailed(eq("event-4"), eq(NotificationDeliveryService.ORDER_EMAIL_CONSUMER), any());
    }

    private record EventPayload(
            String eventId,
            String eventType,
            String orderCode,
            String userEmail,
            String customerName,
            BigDecimal totalAmount,
            String paymentMethod,
            String paymentStatus,
            String orderStatus
    ) {
    }
}
