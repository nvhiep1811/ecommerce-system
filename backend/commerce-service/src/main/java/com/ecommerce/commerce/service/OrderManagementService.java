package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.repository.OrderRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class OrderManagementService {

    private final OrderRepository orderRepository;
    private final InventoryService inventoryService;
    private final PaymentService paymentService;
    private final FlashSaleCheckoutService flashSaleCheckoutService;
    private final OrderQueryService orderQueryService;
    private final OutboxService outboxService;
    private final OrderEventPayloadFactory eventPayloadFactory;
    private final OrderStateMachine orderStateMachine;

    public OrderManagementService(
            OrderRepository orderRepository,
            InventoryService inventoryService,
            PaymentService paymentService,
            FlashSaleCheckoutService flashSaleCheckoutService,
            OrderQueryService orderQueryService,
            OutboxService outboxService,
            OrderEventPayloadFactory eventPayloadFactory,
            OrderStateMachine orderStateMachine
    ) {
        this.orderRepository = orderRepository;
        this.inventoryService = inventoryService;
        this.paymentService = paymentService;
        this.flashSaleCheckoutService = flashSaleCheckoutService;
        this.orderQueryService = orderQueryService;
        this.outboxService = outboxService;
        this.eventPayloadFactory = eventPayloadFactory;
        this.orderStateMachine = orderStateMachine;
    }

    @PreAuthorize("hasRole('SELLER')")
    @Transactional
    public OrderResponse updateStatus(AuthenticatedUser principal, Long orderId, String requestedStatus) {
        OrderEntity order = loadSellerOrder(principal, orderId);
        String targetStatus = normalizeStatus(requestedStatus);
        OrderTransitionContext context = transitionContext();
        if ("cancelled".equals(targetStatus)) {
            return applyTransition(order, principal, orderStateMachine.cancel(order, context));
        }

        String nextStatus = orderStateMachine.nextStatus(order, context);
        if (!targetStatus.equals(nextStatus)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST,
                    "Invalid order transition. Use next/cancel action instead of selecting arbitrary status");
        }
        return applyTransition(order, principal, orderStateMachine.advance(order, context));
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Order status is required");
        }
        try {
            return orderStateMachine.normalize(status);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, exception.getMessage());
        }
    }

    @PreAuthorize("hasRole('SELLER')")
    @Transactional
    public OrderResponse advance(AuthenticatedUser principal, Long orderId) {
        OrderEntity order = loadSellerOrder(principal, orderId);
        return applyTransition(order, principal, orderStateMachine.advance(order, transitionContext()));
    }

    @PreAuthorize("hasRole('SELLER')")
    @Transactional
    public OrderResponse cancel(AuthenticatedUser principal, Long orderId) {
        OrderEntity order = loadSellerOrder(principal, orderId);
        return applyTransition(order, principal, orderStateMachine.cancel(order, transitionContext()));
    }

    private OrderEntity loadSellerOrder(AuthenticatedUser principal, Long orderId) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Order not found"));
        UUID sellerId = UUID.fromString(principal.userId());
        if (!orderRepository.existsSellerOrder(sellerId, orderId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "You can only update orders containing your products");
        }
        return order;
    }

    private OrderTransitionContext transitionContext() {
        return new OrderTransitionContext(inventoryService, paymentService, flashSaleCheckoutService);
    }

    private OrderResponse applyTransition(OrderEntity order, AuthenticatedUser principal, String newStatus) {
        orderRepository.save(order);
        outboxService.publish("ORDER", order.getId().toString(), "ORDER_STATUS_CHANGED",
                eventPayloadFactory.statusChanged(order, newStatus, principal));
        return orderQueryService.getInternal(order.getId());
    }
}
