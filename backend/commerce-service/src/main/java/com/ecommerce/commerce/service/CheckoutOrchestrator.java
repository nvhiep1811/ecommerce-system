package com.ecommerce.commerce.service;

import com.ecommerce.commerce.client.CatalogClient;
import com.ecommerce.commerce.client.UserClient;
import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.OrderItemEntity;
import com.ecommerce.commerce.dto.AddressSnapshotResponse;
import com.ecommerce.commerce.dto.CouponValidationResponse;
import com.ecommerce.commerce.dto.OrderLineRequest;
import com.ecommerce.commerce.dto.OrderQuoteRequest;
import com.ecommerce.commerce.dto.OrderQuoteResponse;
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.dto.PlaceOrderRequest;
import com.ecommerce.commerce.dto.ProductSnapshotResponse;
import com.ecommerce.commerce.repository.OrderItemRepository;
import com.ecommerce.commerce.repository.OrderRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Slf4j
public class CheckoutOrchestrator {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final UserClient userClient;
    private final CatalogClient catalogClient;
    private final InventoryService inventoryService;
    private final PaymentService paymentService;
    private final OrderQueryService orderQueryService;
    private final OutboxService outboxService;

    public CheckoutOrchestrator(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            UserClient userClient,
            CatalogClient catalogClient,
            InventoryService inventoryService,
            PaymentService paymentService,
            OrderQueryService orderQueryService,
            OutboxService outboxService
    ) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.userClient = userClient;
        this.catalogClient = catalogClient;
        this.inventoryService = inventoryService;
        this.paymentService = paymentService;
        this.orderQueryService = orderQueryService;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public OrderQuoteResponse quote(OrderQuoteRequest request) {
        return prepareCheckout(request.items(), request.couponCode(), request.paymentMethod()).toQuoteResponse();
    }

    @Transactional
    public OrderResponse placeOrder(AuthenticatedUser principal, PlaceOrderRequest request) {
        AddressSnapshotResponse address = userClient.getAddress(request.addressId());
        CheckoutPricing pricing = prepareCheckout(request.items(), request.couponCode(), request.paymentMethod());

        OrderEntity order = new OrderEntity();
        order.setOrderNo(generateOrderNo());
        order.setUserId(UUID.fromString(principal.userId()));
        order.setCouponId(pricing.couponId());
        order.setCouponCode(pricing.couponCode());
        order.setShippingMethodName("Standard Delivery");
        order.setOrderStatus("pending");
        order.setPaymentStatus("unpaid");
        order.setFulfillmentStatus("pending");
        order.setReceiverName(address.fullName());
        order.setReceiverPhone(address.phone());
        order.setShippingAddressLine(address.addressLine());
        order.setShippingWard(address.ward());
        order.setShippingDistrict(address.district());
        order.setShippingCity(address.city());
        order.setShippingProvince(address.province());
        order.setShippingPostalCode(address.postalCode());
        order.setShippingCountry(address.country() == null || address.country().isBlank() ? "Vietnam" : address.country());
        order.setPaymentMethodCode(pricing.paymentMethod());
        order.setSubtotal(pricing.subtotal());
        order.setShippingFee(pricing.shippingFee());
        order.setTaxAmount(pricing.tax());
        order.setDiscountAmount(pricing.discount());
        order.setGrandTotal(pricing.total());
        order.setPlacedAt(OffsetDateTime.now());

        OrderEntity savedOrder = orderRepository.save(order);

        List<OrderItemEntity> orderItems = request.items().stream()
                .map(item -> {
                    ProductSnapshotResponse snapshot = pricing.snapshotMap().get(item.productId());
                    OrderItemEntity entity = new OrderItemEntity();
                    entity.setOrderId(savedOrder.getId());
                    entity.setProductId(item.productId());
                    entity.setVariantId(item.variantId());
                    entity.setProductName(snapshot.name());
                    entity.setVariantName(null);
                    entity.setSku(snapshot.sku());
                    entity.setThumbnailUrl(snapshot.thumbnailUrl());
                    entity.setUnitPrice(snapshot.price());
                    entity.setQuantity(item.quantity());
                    entity.setLineTotal(snapshot.price().multiply(BigDecimal.valueOf(item.quantity())).setScale(2, RoundingMode.HALF_UP));
                    entity.setCreatedAt(OffsetDateTime.now());
                    return entity;
                })
                .toList();

        orderItemRepository.saveAll(orderItems);
        inventoryService.reserve(savedOrder.getId(), request.items());
        paymentService.createInitialPayment(savedOrder);

        if (pricing.couponValidation() != null && pricing.couponValidation().coupon() != null) {
            consumeCouponAfterCommit(pricing.couponValidation().coupon().id(), savedOrder.getUserId(), savedOrder.getId());
        }

        outboxService.publish("ORDER", savedOrder.getId().toString(), "ORDER_CREATED", Map.of(
                "orderId", savedOrder.getId(),
                "userId", savedOrder.getUserId(),
                "total", savedOrder.getGrandTotal()
        ));

        return orderQueryService.getInternal(savedOrder.getId());
    }

    private CheckoutPricing prepareCheckout(List<OrderLineRequest> items, String couponCode, String paymentMethod) {
        List<ProductSnapshotResponse> snapshots = catalogClient.getProductSnapshots(
                items.stream().map(OrderLineRequest::productId).toList()
        );

        Map<Long, ProductSnapshotResponse> snapshotMap = snapshots.stream()
                .collect(Collectors.toMap(ProductSnapshotResponse::productId, Function.identity()));

        items.forEach(item -> {
            ProductSnapshotResponse snapshot = snapshotMap.get(item.productId());
            if (snapshot == null || !snapshot.active()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Product " + item.productId() + " is unavailable");
            }
        });

        BigDecimal subtotal = items.stream()
                .map(item -> snapshotMap.get(item.productId()).price().multiply(BigDecimal.valueOf(item.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        CouponValidationResponse couponValidation = null;
        BigDecimal discount = BigDecimal.ZERO;
        if (couponCode != null && !couponCode.isBlank()) {
            couponValidation = catalogClient.validateCoupon(couponCode, subtotal);
            if (!couponValidation.valid()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, couponValidation.message());
            }
            discount = couponValidation.discount().setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal shippingFee = BigDecimal.valueOf(5).setScale(2, RoundingMode.HALF_UP);
        BigDecimal tax = subtotal.multiply(BigDecimal.valueOf(0.10)).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(shippingFee).add(tax).subtract(discount).setScale(2, RoundingMode.HALF_UP);

        return new CheckoutPricing(
                snapshotMap,
                subtotal,
                tax,
                shippingFee,
                discount,
                total,
                couponValidation,
                normalizePaymentMethod(paymentMethod)
        );
    }

    private String normalizePaymentMethod(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            return "COD";
        }

        return switch (paymentMethod.trim().toUpperCase()) {
            case "MEGAPAY", "MOMO" -> "MOMO";
            case "CARD" -> "CARD";
            case "BANK_TRANSFER" -> "BANK_TRANSFER";
            case "VNPAY" -> "VNPAY";
            case "PAYPAL" -> "PAYPAL";
            default -> "COD";
        };
    }

    private String generateOrderNo() {
        return "ORD-" + OffsetDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + "-"
                + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    private void consumeCouponAfterCommit(Long couponId, UUID userId, Long orderId) {
        Runnable consumeAction = () -> {
            try {
                catalogClient.consumeCoupon(couponId, userId, orderId);
            } catch (Exception exception) {
                log.error("Failed to consume coupon {} for order {}", couponId, orderId, exception);
            }
        };

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    consumeAction.run();
                }
            });
            return;
        }

        // Fallback for non-transactional contexts (e.g., direct unit invocation)
        consumeAction.run();
    }

    private record CheckoutPricing(
            Map<Long, ProductSnapshotResponse> snapshotMap,
            BigDecimal subtotal,
            BigDecimal tax,
            BigDecimal shippingFee,
            BigDecimal discount,
            BigDecimal total,
            CouponValidationResponse couponValidation,
            String paymentMethod
    ) {
        private Long couponId() {
            return couponValidation != null && couponValidation.coupon() != null ? couponValidation.coupon().id() : null;
        }

        private String couponCode() {
            return couponValidation != null && couponValidation.coupon() != null ? couponValidation.coupon().code() : null;
        }

        private OrderQuoteResponse toQuoteResponse() {
            return new OrderQuoteResponse(subtotal, tax, shippingFee, discount, total, paymentMethod, couponValidation);
        }
    }
}
