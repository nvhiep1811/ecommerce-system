package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.stereotype.Service;

@Service
public class OrderEventPublisher {

    private final OutboxService outboxService;
    private final OrderEventPayloadFactory eventPayloadFactory;

    public OrderEventPublisher(OutboxService outboxService, OrderEventPayloadFactory eventPayloadFactory) {
        this.outboxService = outboxService;
        this.eventPayloadFactory = eventPayloadFactory;
    }

    public void publishOrderCreated(OrderEntity order, PaymentEntity payment, AuthenticatedUser principal) {
        outboxService.publish(
                "ORDER",
                order.getId().toString(),
                "ORDER_CREATED",
                eventPayloadFactory.orderEvent("ORDER_CREATED", order, payment, principal)
        );
    }

    public void publishOrderCancelled(OrderEntity order, PaymentEntity payment, AuthenticatedUser principal) {
        outboxService.publish(
                "ORDER",
                order.getId().toString(),
                "ORDER_CANCELLED",
                eventPayloadFactory.orderEvent("ORDER_CANCELLED", order, payment, principal)
        );
    }

    public void publishOrderStatusUpdated(OrderEntity order, PaymentEntity payment, AuthenticatedUser principal) {
        outboxService.publish(
                "ORDER",
                order.getId().toString(),
                "ORDER_STATUS_UPDATED",
                eventPayloadFactory.orderEvent("ORDER_STATUS_UPDATED", order, payment, principal)
        );
    }

    public void publishPaymentStatusUpdated(OrderEntity order, PaymentEntity payment, AuthenticatedUser principal) {
        outboxService.publish(
                "ORDER",
                order.getId().toString(),
                "PAYMENT_STATUS_UPDATED",
                eventPayloadFactory.orderEvent("PAYMENT_STATUS_UPDATED", order, payment, principal)
        );
    }

    public void publishOrderStatusChanged(OrderEntity order, String newStatus, AuthenticatedUser principal) {
        outboxService.publish(
                "ORDER",
                order.getId().toString(),
                "ORDER_STATUS_CHANGED",
                eventPayloadFactory.statusChanged(order, newStatus, principal)
        );
    }
}