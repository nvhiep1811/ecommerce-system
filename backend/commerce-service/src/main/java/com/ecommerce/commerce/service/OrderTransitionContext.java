package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.shared.web.BusinessException;
import org.springframework.http.HttpStatus;

import java.time.OffsetDateTime;

public record OrderTransitionContext(
        InventoryService inventoryService,
        PaymentService paymentService
) {

    public OffsetDateTime now() {
        return OffsetDateTime.now();
    }

    public boolean isOnlinePayment(OrderEntity order) {
        return PaymentConstants.ONLINE_SEPAY_METHODS.contains(order.getPaymentMethodCode());
    }

    public boolean isPaid(OrderEntity order) {
        return PaymentConstants.PAYMENT_PAID.equals(order.getPaymentStatus());
    }

    public void confirmInventory(OrderEntity order) {
        inventoryService.confirmReservations(order.getId());
    }

    public void cancelInventory(OrderEntity order) {
        inventoryService.cancelReservations(order.getId());
    }

    public void cancelOpenPayment(OrderEntity order) {
        paymentService.cancelOpenPayment(order.getId(), "Order cancelled before fulfillment");
    }

    public void markCodPaid(OrderEntity order) {
        paymentService.markPaid(order.getId());
        order.setPaymentStatus(PaymentConstants.PAYMENT_PAID);
        order.setPaidAt(now());
    }

    public BusinessException conflict(String message) {
        return new BusinessException(HttpStatus.CONFLICT, message);
    }

    public BusinessException badRequest(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, message);
    }
}
