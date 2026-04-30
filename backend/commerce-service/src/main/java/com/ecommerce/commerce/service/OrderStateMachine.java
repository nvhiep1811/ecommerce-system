package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class OrderStateMachine {

    private final Map<String, OrderState> states = new LinkedHashMap<>();

    public OrderStateMachine() {
        register(new PendingState());
        register(new PendingPaymentState());
        register(new PaidState());
        register(new ConfirmedState());
        register(new ProcessingState());
        register(new ShippingState());
        register(new DeliveredState());
        register(new CancelledState());
        register(new PaymentExpiredState());
    }

    public String nextStatus(OrderEntity order, OrderTransitionContext context) {
        return stateFor(order).nextStatus(order, context);
    }

    public String advance(OrderEntity order, OrderTransitionContext context) {
        return stateFor(order).advance(order, context);
    }

    public String cancel(OrderEntity order, OrderTransitionContext context) {
        return stateFor(order).cancel(order, context);
    }

    public String normalize(String status) {
        if (status == null || status.isBlank()) {
            throw new IllegalArgumentException("Order status is required");
        }
        return "shipped".equalsIgnoreCase(status) ? "shipping" : status.toLowerCase();
    }

    private void register(OrderState state) {
        states.put(state.status(), state);
    }

    private OrderState stateFor(OrderEntity order) {
        String status = normalize(order.getOrderStatus());
        OrderState state = states.get(status);
        if (state == null) {
            throw new IllegalStateException("Unsupported order status " + order.getOrderStatus());
        }
        return state;
    }

    private interface OrderState {
        String status();

        String nextStatus(OrderEntity order, OrderTransitionContext context);

        String advance(OrderEntity order, OrderTransitionContext context);

        String cancel(OrderEntity order, OrderTransitionContext context);
    }

    private abstract static class BaseOrderState implements OrderState {
        @Override
        public String nextStatus(OrderEntity order, OrderTransitionContext context) {
            throw context.conflict("Order cannot advance from status " + order.getOrderStatus());
        }

        @Override
        public String advance(OrderEntity order, OrderTransitionContext context) {
            throw context.conflict("Order cannot advance from status " + order.getOrderStatus());
        }

        @Override
        public String cancel(OrderEntity order, OrderTransitionContext context) {
            throw context.conflict("Order cannot be cancelled from status " + order.getOrderStatus());
        }

        protected String confirm(OrderEntity order, OrderTransitionContext context) {
            if (context.isOnlinePayment(order) && !context.isPaid(order)) {
                throw context.conflict("Online payment must be paid before confirming order");
            }
            context.confirmInventory(order);
            order.setOrderStatus("confirmed");
            order.setFulfillmentStatus("pending");
            return "confirmed";
        }

        protected String cancelBeforeShipment(OrderEntity order, OrderTransitionContext context) {
            if (context.isOnlinePayment(order) && context.isPaid(order)) {
                throw context.conflict("Paid online order cancellation requires refund flow before cancellation");
            }
            context.cancelInventory(order);
            context.cancelOpenPayment(order);
            order.setOrderStatus("cancelled");
            order.setFulfillmentStatus("cancelled");
            order.setCancelledAt(context.now());
            order.setPaymentStatus(PaymentConstants.PAYMENT_CANCELLED);
            return "cancelled";
        }
    }

    private static class PendingState extends BaseOrderState {
        @Override
        public String status() {
            return PaymentConstants.ORDER_PENDING;
        }

        @Override
        public String nextStatus(OrderEntity order, OrderTransitionContext context) {
            return "confirmed";
        }

        @Override
        public String advance(OrderEntity order, OrderTransitionContext context) {
            return confirm(order, context);
        }

        @Override
        public String cancel(OrderEntity order, OrderTransitionContext context) {
            return cancelBeforeShipment(order, context);
        }
    }

    private static class PendingPaymentState extends BaseOrderState {
        @Override
        public String status() {
            return PaymentConstants.ORDER_PENDING_PAYMENT;
        }

        @Override
        public String nextStatus(OrderEntity order, OrderTransitionContext context) {
            throw context.conflict("Online payment must be paid before confirming order");
        }

        @Override
        public String cancel(OrderEntity order, OrderTransitionContext context) {
            context.cancelInventory(order);
            context.cancelOpenPayment(order);
            order.setOrderStatus("cancelled");
            order.setFulfillmentStatus("cancelled");
            order.setCancelledAt(context.now());
            order.setPaymentStatus(PaymentConstants.PAYMENT_CANCELLED);
            return "cancelled";
        }
    }

    private static class PaidState extends BaseOrderState {
        @Override
        public String status() {
            return PaymentConstants.ORDER_PAID;
        }

        @Override
        public String nextStatus(OrderEntity order, OrderTransitionContext context) {
            return "confirmed";
        }

        @Override
        public String advance(OrderEntity order, OrderTransitionContext context) {
            return confirm(order, context);
        }
    }

    private static class ConfirmedState extends BaseOrderState {
        @Override
        public String status() {
            return "confirmed";
        }

        @Override
        public String nextStatus(OrderEntity order, OrderTransitionContext context) {
            return "shipping";
        }

        @Override
        public String advance(OrderEntity order, OrderTransitionContext context) {
            order.setOrderStatus("shipping");
            order.setFulfillmentStatus("shipping");
            return "shipping";
        }

        @Override
        public String cancel(OrderEntity order, OrderTransitionContext context) {
            return cancelBeforeShipment(order, context);
        }
    }

    private static class ProcessingState extends ConfirmedState {
        @Override
        public String status() {
            return "processing";
        }
    }

    private static class ShippingState extends BaseOrderState {
        @Override
        public String status() {
            return "shipping";
        }

        @Override
        public String nextStatus(OrderEntity order, OrderTransitionContext context) {
            return "delivered";
        }

        @Override
        public String advance(OrderEntity order, OrderTransitionContext context) {
            order.setOrderStatus("delivered");
            order.setFulfillmentStatus("delivered");
            order.setDeliveredAt(context.now());
            if (PaymentConstants.METHOD_COD.equalsIgnoreCase(order.getPaymentMethodCode())) {
                context.markCodPaid(order);
            }
            return "delivered";
        }
    }

    private static class DeliveredState extends BaseOrderState {
        @Override
        public String status() {
            return "delivered";
        }
    }

    private static class CancelledState extends BaseOrderState {
        @Override
        public String status() {
            return "cancelled";
        }
    }

    private static class PaymentExpiredState extends BaseOrderState {
        @Override
        public String status() {
            return PaymentConstants.ORDER_PAYMENT_EXPIRED;
        }
    }
}
