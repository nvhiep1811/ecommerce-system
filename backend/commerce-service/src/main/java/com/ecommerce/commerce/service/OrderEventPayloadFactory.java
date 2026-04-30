package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Component
public class OrderEventPayloadFactory {

    public Map<String, Object> orderEvent(String eventType, OrderEntity order, PaymentEntity payment, AuthenticatedUser principal) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventId", UUID.randomUUID().toString());
        payload.put("eventType", eventType);
        payload.put("occurredAt", OffsetDateTime.now());
        payload.put("orderId", order.getId());
        payload.put("orderCode", order.getOrderNo());
        payload.put("userId", order.getUserId());
        String recipientEmail = principal != null ? principal.email() : payment != null ? payment.getCustomerEmail() : null;
        payload.put("userEmail", recipientEmail);
        payload.put("customerEmail", recipientEmail);
        payload.put("customerName", order.getReceiverName());
        payload.put("totalAmount", order.getGrandTotal());
        payload.put("currency", payment != null ? payment.getCurrency() : "VND");
        payload.put("paymentMethod", order.getPaymentMethodCode());
        payload.put("paymentStatus", payment != null ? payment.getStatus() : order.getPaymentStatus());
        payload.put("orderStatus", order.getOrderStatus());
        if (payment != null) {
            payload.put("paymentId", payment.getId());
            payload.put("invoiceNumber", payment.getInvoiceNumber());
            payload.put("transferContent", payment.getTransferContent());
            payload.put("qrCodeUrl", payment.getQrCodeUrl());
            payload.put("checkoutUrl", payment.getCheckoutUrl());
            payload.put("expiredAt", payment.getExpiredAt());
            payload.put("paidAt", payment.getPaidAt());
        }
        return payload;
    }

    public Map<String, Object> statusChanged(OrderEntity order, String status, AuthenticatedUser principal) {
        Map<String, Object> payload = orderEvent("ORDER_STATUS_CHANGED", order, null, principal);
        payload.put("status", status);
        payload.put("actor", principal != null ? principal.userId() : null);
        return payload;
    }
}
