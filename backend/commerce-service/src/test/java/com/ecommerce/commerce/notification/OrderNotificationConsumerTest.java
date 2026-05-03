package com.ecommerce.commerce.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class OrderNotificationConsumerTest {

    private final MailService mailService = mock(MailService.class);
    private final OrderNotificationConsumer consumer = new OrderNotificationConsumer(mailService);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void notificationConsumerShouldSendOrderCreatedEmail() {
        consumer.handle(objectMapper.valueToTree(new EventPayload(
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
    }

    @Test
    void notificationConsumerShouldSendOrderPaidEmail() {
        consumer.handle(objectMapper.valueToTree(new EventPayload(
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
    }

    private record EventPayload(
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
