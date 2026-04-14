package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.OrderItemEntity;
import com.ecommerce.commerce.dto.OrderAddressResponse;
import com.ecommerce.commerce.dto.OrderItemProductResponse;
import com.ecommerce.commerce.dto.OrderItemResponse;
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.repository.OrderItemRepository;
import com.ecommerce.commerce.repository.OrderRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class OrderQueryService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;

    public OrderQueryService(OrderRepository orderRepository, OrderItemRepository orderItemRepository) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
    }

    public List<OrderResponse> listMine(AuthenticatedUser principal, String status) {
        UUID userId = UUID.fromString(principal.userId());
        List<OrderEntity> orders = status == null || status.isBlank()
                ? orderRepository.findByUserIdOrderByCreatedAtDesc(userId)
                : orderRepository.findByUserIdAndOrderStatusOrderByCreatedAtDesc(userId, normalizeStatus(status));
        return toResponses(orders);
    }

    public List<OrderResponse> listSeller(AuthenticatedUser principal, String status) {
        UUID sellerId = UUID.fromString(principal.userId());
        List<OrderEntity> orders = status == null || status.isBlank()
                ? orderRepository.findSellerOrders(sellerId)
                : orderRepository.findSellerOrdersByStatus(sellerId, normalizeStatus(status));
        return toResponses(orders);
    }

    public OrderResponse getForUser(AuthenticatedUser principal, Long orderId) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Order not found"));
        UUID requester = UUID.fromString(principal.userId());
        boolean seller = principal.roles().contains("SELLER");
        if (seller) {
            if (!orderRepository.existsSellerOrder(requester, orderId)) {
                throw new BusinessException(HttpStatus.FORBIDDEN, "You do not have access to this order");
            }
        } else if (!requester.equals(order.getUserId())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "You do not have access to this order");
        }
        return toResponse(order, orderItemRepository.findByOrderIdOrderByIdAsc(order.getId()));
    }

    public OrderResponse getInternal(Long orderId) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new EntityNotFoundException("Order not found"));
        return toResponse(order, orderItemRepository.findByOrderIdOrderByIdAsc(order.getId()));
    }

    private List<OrderResponse> toResponses(List<OrderEntity> orders) {
        Map<Long, List<OrderItemEntity>> itemsByOrderId = orderItemRepository.findByOrderIdInOrderByOrderIdAscIdAsc(
                        orders.stream().map(OrderEntity::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(OrderItemEntity::getOrderId));

        return orders.stream()
                .map(order -> toResponse(order, itemsByOrderId.getOrDefault(order.getId(), List.of())))
                .toList();
    }

    private OrderResponse toResponse(OrderEntity order, List<OrderItemEntity> items) {
        return new OrderResponse(
                order.getId(),
                order.getOrderNo(),
                order.getUserId(),
                toClientStatus(order.getOrderStatus()),
                order.getSubtotal(),
                order.getTaxAmount(),
                order.getShippingFee(),
                order.getDiscountAmount(),
                order.getGrandTotal(),
                order.getPaymentStatus(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                new OrderAddressResponse(
                        order.getReceiverName(),
                        order.getReceiverPhone(),
                        order.getShippingAddressLine(),
                        order.getShippingCity(),
                        order.getShippingProvince(),
                        order.getShippingPostalCode()
                ),
                items.stream().map(this::toItemResponse).toList()
        );
    }

    private OrderItemResponse toItemResponse(OrderItemEntity item) {
        return new OrderItemResponse(
                item.getId(),
                item.getProductId(),
                item.getQuantity(),
                item.getUnitPrice(),
                new OrderItemProductResponse(
                        item.getProductId(),
                        item.getProductName(),
                        item.getThumbnailUrl(),
                        item.getUnitPrice(),
                        null,
                        0
                )
        );
    }

    private String toClientStatus(String orderStatus) {
        return switch (orderStatus) {
            case "shipping" -> "shipped";
            default -> orderStatus;
        };
    }

    private String normalizeStatus(String status) {
        return "shipped".equalsIgnoreCase(status) ? "shipping" : status.toLowerCase();
    }
}
