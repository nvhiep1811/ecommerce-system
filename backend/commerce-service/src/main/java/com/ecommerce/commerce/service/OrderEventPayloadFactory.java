package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.OrderItemEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import com.ecommerce.commerce.repository.OrderItemRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

@Component
public class OrderEventPayloadFactory {

    private final OrderItemRepository orderItemRepository;

    public OrderEventPayloadFactory(OrderItemRepository orderItemRepository) {
        this.orderItemRepository = orderItemRepository;
    }

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
        payload.put("placedAt", order.getPlacedAt());
        payload.put("paidAt", order.getPaidAt());
        payload.put("subtotal", order.getSubtotal());
        payload.put("shippingFee", order.getShippingFee());
        payload.put("taxAmount", order.getTaxAmount());
        payload.put("discountAmount", order.getDiscountAmount());
        payload.put("shippingMethodName", order.getShippingMethodName());
        payload.put("receiverPhone", order.getReceiverPhone());
        payload.put("shippingAddress", shippingAddress(order));
        payload.put("items", orderItems(order.getId()));
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

    private List<Map<String, Object>> orderItems(Long orderId) {
        if (orderId == null) {
            return List.of();
        }
        return orderItemRepository.findByOrderIdOrderByIdAsc(orderId).stream()
                .map(this::orderItem)
                .toList();
    }

    private Map<String, Object> orderItem(OrderItemEntity item) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("productId", item.getProductId());
        payload.put("variantId", item.getVariantId());
        payload.put("productName", item.getProductName());
        payload.put("variantName", item.getVariantName());
        payload.put("sku", item.getSku());
        payload.put("unitPrice", item.getUnitPrice());
        payload.put("quantity", item.getQuantity());
        payload.put("lineTotal", item.getLineTotal());
        return payload;
    }

    private String shippingAddress(OrderEntity order) {
        return Stream.of(
                        order.getShippingAddressLine(),
                        order.getShippingWard(),
                        order.getShippingDistrict(),
                        order.getShippingCity(),
                        order.getShippingProvince(),
                        order.getShippingPostalCode(),
                        order.getShippingCountry()
                )
                .filter(value -> value != null && !value.isBlank())
                .reduce((left, right) -> left + ", " + right)
                .orElse("");
    }
}
