package com.ecommerce.commerce.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record OrderResponse(
        Long id,
        String orderNo,
        UUID userId,
        String status,
        BigDecimal subtotal,
        BigDecimal tax,
        Long shippingMethodId,
        String shippingMethodName,
        BigDecimal shippingFee,
        BigDecimal discount,
        BigDecimal total,
        String paymentStatus,
        String paymentMethod,
        String nextAction,
        PaymentInstructionResponse payment,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        OrderAddressResponse address,
        List<OrderItemResponse> items,
        List<OrderSellerResponse> sellers
) {
    public OrderResponse(
            Long id,
            String orderNo,
            UUID userId,
            String status,
            BigDecimal subtotal,
            BigDecimal tax,
            Long shippingMethodId,
            String shippingMethodName,
            BigDecimal shippingFee,
            BigDecimal discount,
            BigDecimal total,
            String paymentStatus,
            String paymentMethod,
            String nextAction,
            PaymentInstructionResponse payment,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            OrderAddressResponse address,
            List<OrderItemResponse> items
    ) {
        this(
                id,
                orderNo,
                userId,
                status,
                subtotal,
                tax,
                shippingMethodId,
                shippingMethodName,
                shippingFee,
                discount,
                total,
                paymentStatus,
                paymentMethod,
                nextAction,
                payment,
                createdAt,
                updatedAt,
                address,
                items,
                List.of()
        );
    }
}
