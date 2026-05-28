package com.ecommerce.commerce.notification;

import com.ecommerce.commerce.observability.CommerceBusinessMetrics;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
    private final CommerceBusinessMetrics businessMetrics = mock(CommerceBusinessMetrics.class);
    private final OrderNotificationConsumer consumer = new OrderNotificationConsumer(mailService, deliveryService, businessMetrics);
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

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventId", "event-2");
        payload.put("eventType", "ORDER_PAID");
        payload.put("orderCode", "ORD-1");
        payload.put("userEmail", "buyer@example.com");
        payload.put("customerName", "Nguyen Van A");
        payload.put("totalAmount", new BigDecimal("1500000"));
        payload.put("subtotal", new BigDecimal("1400000"));
        payload.put("shippingFee", new BigDecimal("30000"));
        payload.put("taxAmount", new BigDecimal("100000"));
        payload.put("discountAmount", new BigDecimal("30000"));
        payload.put("paymentMethod", "SEPAY_QR");
        payload.put("paymentStatus", "paid");
        payload.put("orderStatus", "paid");
        payload.put("receiverPhone", "0900000000");
        payload.put("shippingAddress", "123 Le Loi, Quan 1, TP HCM");
        payload.put("shippingMethodName", "Giao hang tieu chuan");
        payload.put("items", List.of(Map.of(
                "productName", "Ao thun",
                "variantName", "Mau den / Size L",
                "unitPrice", new BigDecimal("700000"),
                "quantity", 2,
                "lineTotal", new BigDecimal("1400000")
        )));

        consumer.handle(objectMapper.valueToTree(payload));

        verify(mailService).send(
                eq("buyer@example.com"),
                contains("Thanh toán thành công"),
                contains("Chi tiết sản phẩm")
        );
        verify(mailService).send(eq("buyer@example.com"), anyString(), contains("Ao thun"));
        verify(mailService).send(eq("buyer@example.com"), anyString(), contains("123 Le Loi"));
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
