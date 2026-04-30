package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.OrderItemEntity;
import com.ecommerce.commerce.dto.OrderAddressResponse;
import com.ecommerce.commerce.dto.OrderItemProductResponse;
import com.ecommerce.commerce.dto.OrderItemResponse;
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.dto.PaymentInstructionResponse;
import com.ecommerce.commerce.repository.OrderItemRepository;
import com.ecommerce.commerce.repository.OrderRepository;
import com.ecommerce.commerce.repository.PaymentRepository;
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
    private final PaymentRepository paymentRepository;

    public OrderQueryService(OrderRepository orderRepository, OrderItemRepository orderItemRepository, PaymentRepository paymentRepository) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.paymentRepository = paymentRepository;
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
        boolean admin = principal.roles().contains("ADMIN");
        boolean seller = principal.roles().contains("SELLER");
        if (admin) {
            return toResponse(order, orderItemRepository.findByOrderIdOrderByIdAsc(order.getId()));
        }
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
        PaymentInstructionResponse payment = paymentRepository.findTopByOrderIdOrderByAttemptNoDesc(order.getId())
                .map(this::toPaymentInstruction)
                .orElse(null);

        return new OrderResponse(
                order.getId(),
                order.getOrderNo(),
                order.getUserId(),
                toClientStatus(order.getOrderStatus()),
                order.getSubtotal(),
                order.getTaxAmount(),
                order.getShippingMethodId(),
                order.getShippingMethodName(),
                order.getShippingFee(),
                order.getDiscountAmount(),
                order.getGrandTotal(),
                order.getPaymentStatus(),
                order.getPaymentMethodCode(),
                nextAction(order.getPaymentMethodCode(), order.getOrderStatus(), payment),
                payment,
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

    private PaymentInstructionResponse toPaymentInstruction(com.ecommerce.commerce.domain.PaymentEntity payment) {
        return new PaymentInstructionResponse(
                payment.getId(),
                payment.getStatus(),
                payment.getAmount(),
                payment.getCurrency(),
                payment.getInvoiceNumber(),
                payment.getQrCodeUrl(),
                payment.getQrImageBase64(),
                payment.getQrContent(),
                payment.getTransferContent(),
                payment.getBankName(),
                payment.getBankCode(),
                payment.getBankBin(),
                payment.getBankAccountNumber(),
                payment.getAccountName(),
                payment.getBankDeepLink(),
                payment.getCheckoutUrl(),
                payment.getExpiredAt()
        );
    }

    private String nextAction(String paymentMethod, String orderStatus, PaymentInstructionResponse payment) {
        if (PaymentConstants.METHOD_COD.equalsIgnoreCase(paymentMethod) && PaymentConstants.ORDER_PENDING.equals(orderStatus)) {
            return PaymentConstants.NEXT_WAIT_FOR_SELLER_CONFIRMATION;
        }
        if (payment == null || !PaymentConstants.PAYMENT_PENDING.equals(payment.status())) {
            return PaymentConstants.NEXT_NONE;
        }
        if (PaymentConstants.METHOD_SEPAY_QR.equalsIgnoreCase(paymentMethod) && PaymentConstants.ORDER_PENDING_PAYMENT.equals(orderStatus)) {
            return PaymentConstants.NEXT_SHOW_QR;
        }
        if ((PaymentConstants.METHOD_SEPAY_CHECKOUT.equalsIgnoreCase(paymentMethod)
                || PaymentConstants.METHOD_SEPAY_CARD.equalsIgnoreCase(paymentMethod))
                && PaymentConstants.ORDER_PENDING_PAYMENT.equals(orderStatus)) {
            return PaymentConstants.NEXT_OPEN_CHECKOUT_URL;
        }
        return PaymentConstants.NEXT_NONE;
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
