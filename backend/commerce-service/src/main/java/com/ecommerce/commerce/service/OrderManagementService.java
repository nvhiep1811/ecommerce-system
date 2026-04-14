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

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class OrderManagementService {

    private final OrderRepository orderRepository;
    private final InventoryService inventoryService;
    private final PaymentService paymentService;
    private final OrderQueryService orderQueryService;
    private final OutboxService outboxService;

    public OrderManagementService(
            OrderRepository orderRepository,
            InventoryService inventoryService,
            PaymentService paymentService,
            OrderQueryService orderQueryService,
            OutboxService outboxService
    ) {
        this.orderRepository = orderRepository;
        this.inventoryService = inventoryService;
        this.paymentService = paymentService;
        this.orderQueryService = orderQueryService;
        this.outboxService = outboxService;
    }

    @PreAuthorize("hasRole('SELLER')")
    @Transactional
    public OrderResponse updateStatus(AuthenticatedUser principal, Long orderId, String requestedStatus) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Order not found"));
        UUID sellerId = UUID.fromString(principal.userId());
        if (!orderRepository.existsSellerOrder(sellerId, orderId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "You can only update orders containing your products");
        }

        String newStatus = normalizeStatus(requestedStatus);
        switch (newStatus) {
            case "confirmed" -> {
                inventoryService.confirmReservations(orderId);
                order.setOrderStatus("confirmed");
            }
            case "shipping" -> {
                order.setOrderStatus("shipping");
                order.setFulfillmentStatus("shipping");
            }
            case "delivered" -> {
                order.setOrderStatus("delivered");
                order.setFulfillmentStatus("delivered");
                order.setDeliveredAt(OffsetDateTime.now());
                if ("COD".equalsIgnoreCase(order.getPaymentMethodCode())) {
                    paymentService.markPaid(orderId);
                    order.setPaymentStatus("paid");
                    order.setPaidAt(OffsetDateTime.now());
                }
            }
            case "cancelled" -> {
                inventoryService.releaseReservations(orderId);
                order.setOrderStatus("cancelled");
                order.setFulfillmentStatus("cancelled");
                order.setCancelledAt(OffsetDateTime.now());
                order.setPaymentStatus("failed");
            }
            default -> order.setOrderStatus(newStatus);
        }

        orderRepository.save(order);
        outboxService.publish("ORDER", orderId.toString(), "ORDER_STATUS_UPDATED", Map.of(
                "orderId", orderId,
                "status", newStatus,
                "actor", principal.userId()
        ));
        return orderQueryService.getInternal(orderId);
    }

    private String normalizeStatus(String status) {
        String normalized = "shipped".equalsIgnoreCase(status) ? "shipping" : status.toLowerCase();
        if (!Set.of("pending", "confirmed", "shipping", "delivered", "cancelled").contains(normalized)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Unsupported order status");
        }
        return normalized;
    }
}
