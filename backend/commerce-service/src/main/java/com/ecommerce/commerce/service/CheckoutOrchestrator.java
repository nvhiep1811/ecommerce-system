package com.ecommerce.commerce.service;

import com.ecommerce.commerce.client.CatalogClient;
import com.ecommerce.commerce.client.UserClient;
import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.OrderItemEntity;
import com.ecommerce.commerce.domain.ShippingMethodEntity;
import com.ecommerce.commerce.dto.AddressSnapshotResponse;
import com.ecommerce.commerce.dto.CouponValidationResponse;
import com.ecommerce.commerce.dto.OrderLineRequest;
import com.ecommerce.commerce.dto.OrderQuoteRequest;
import com.ecommerce.commerce.dto.OrderQuoteResponse;
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.dto.PlaceOrderRequest;
import com.ecommerce.commerce.dto.ProductSnapshotRequest;
import com.ecommerce.commerce.dto.ProductSnapshotResponse;
import com.ecommerce.commerce.observability.CommerceBusinessMetrics;
import com.ecommerce.commerce.repository.OrderItemRepository;
import com.ecommerce.commerce.repository.OrderRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionOperations;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@Slf4j
public class CheckoutOrchestrator {

    private static final Pattern CLIENT_REQUEST_ID_PATTERN = Pattern.compile("^[A-Za-z0-9._:-]{1,80}$");

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final UserClient userClient;
    private final CatalogClient catalogClient;
    private final InventoryService inventoryService;
    private final PaymentService paymentService;
    private final PaymentMethodService paymentMethodService;
    private final ShippingMethodService shippingMethodService;
    private final FlashSaleCheckoutService flashSaleCheckoutService;
    private final OrderQueryService orderQueryService;
    private final OutboxService outboxService;
    private final OrderEventPayloadFactory eventPayloadFactory;
    private final TransactionOperations transactionOperations;
    private final CommerceBusinessMetrics businessMetrics;

    public CheckoutOrchestrator(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            UserClient userClient,
            CatalogClient catalogClient,
            InventoryService inventoryService,
            PaymentService paymentService,
            PaymentMethodService paymentMethodService,
            ShippingMethodService shippingMethodService,
            FlashSaleCheckoutService flashSaleCheckoutService,
            OrderQueryService orderQueryService,
            OutboxService outboxService,
            OrderEventPayloadFactory eventPayloadFactory,
            TransactionOperations transactionOperations,
            CommerceBusinessMetrics businessMetrics
    ) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.userClient = userClient;
        this.catalogClient = catalogClient;
        this.inventoryService = inventoryService;
        this.paymentService = paymentService;
        this.paymentMethodService = paymentMethodService;
        this.shippingMethodService = shippingMethodService;
        this.flashSaleCheckoutService = flashSaleCheckoutService;
        this.orderQueryService = orderQueryService;
        this.outboxService = outboxService;
        this.eventPayloadFactory = eventPayloadFactory;
        this.transactionOperations = transactionOperations;
        this.businessMetrics = businessMetrics;
    }

    @Transactional(readOnly = true)
    public OrderQuoteResponse quote(OrderQuoteRequest request) {
        return prepareCheckout(null, request.items(), request.couponCode(), request.paymentMethod(), request.shippingMethodId()).toQuoteResponse();
    }

    @Transactional(readOnly = true)
    public OrderQuoteResponse quote(AuthenticatedUser principal, OrderQuoteRequest request) {
        UUID userId = principal == null ? null : UUID.fromString(principal.userId());
        return prepareCheckout(userId, request.items(), request.couponCode(), request.paymentMethod(), request.shippingMethodId()).toQuoteResponse();
    }

    public OrderResponse placeOrder(AuthenticatedUser principal, PlaceOrderRequest request) {
        long startedNanos = businessMetrics.startTimer();
        boolean metricRecorded = false;
        UUID userId = UUID.fromString(principal.userId());
        String clientRequestId = normalizeClientRequestId(request.clientRequestId());
        try {
            if (clientRequestId != null) {
                var existingOrder = orderRepository.findByUserIdAndClientRequestId(userId, clientRequestId);
                if (existingOrder.isPresent()) {
                    OrderResponse response = orderQueryService.getInternal(existingOrder.get().getId());
                    businessMetrics.recordCheckout("idempotent", request.paymentMethod(), startedNanos);
                    metricRecorded = true;
                    return response;
                }
            }

            try {
                OrderResponse response = transactionOperations.execute(status -> placeOrderInTransaction(principal, request, userId, clientRequestId));
                businessMetrics.recordCheckout("created", request.paymentMethod(), startedNanos);
                metricRecorded = true;
                return response;
            } catch (DataIntegrityViolationException exception) {
                if (clientRequestId == null) {
                    businessMetrics.recordCheckout("failed", request.paymentMethod(), startedNanos);
                    metricRecorded = true;
                    throw exception;
                }

                var existingOrder = orderRepository.findByUserIdAndClientRequestId(userId, clientRequestId);
                if (existingOrder.isPresent()) {
                    OrderResponse response = orderQueryService.getInternal(existingOrder.get().getId());
                    businessMetrics.recordCheckout("idempotent_race", request.paymentMethod(), startedNanos);
                    metricRecorded = true;
                    return response;
                }

                businessMetrics.recordCheckout("failed", request.paymentMethod(), startedNanos);
                metricRecorded = true;
                throw exception;
            }
        } catch (RuntimeException exception) {
            if (!metricRecorded) {
                businessMetrics.recordCheckout("failed", request.paymentMethod(), startedNanos);
            }
            throw exception;
        }
    }

    private OrderResponse placeOrderInTransaction(
            AuthenticatedUser principal,
            PlaceOrderRequest request,
            UUID userId,
            String clientRequestId
    ) {
        if (clientRequestId != null) {
            var existingOrder = orderRepository.findByUserIdAndClientRequestId(userId, clientRequestId);
            if (existingOrder.isPresent()) {
                return orderQueryService.getInternal(existingOrder.get().getId());
            }
        }

        AddressSnapshotResponse address = userClient.getAddress(request.addressId());
        CheckoutPricing pricing = prepareCheckout(userId, request.items(), request.couponCode(), request.paymentMethod(), request.shippingMethodId());

        OrderEntity order = new OrderEntity();
        order.setOrderNo(generateOrderNo());
        order.setClientRequestId(clientRequestId);
        order.setUserId(userId);
        order.setCouponId(pricing.couponId());
        order.setCouponCode(pricing.couponCode());
        order.setShippingMethodId(pricing.shippingMethodId());
        order.setShippingMethodName(pricing.shippingMethodName());
        if (PaymentConstants.ONLINE_SEPAY_METHODS.contains(pricing.paymentMethod())) {
            order.setOrderStatus(PaymentConstants.ORDER_PENDING_PAYMENT);
            order.setPaymentStatus(PaymentConstants.PAYMENT_PENDING);
        } else {
            order.setOrderStatus(PaymentConstants.ORDER_PENDING);
            order.setPaymentStatus(PaymentConstants.PAYMENT_UNPAID);
        }
        order.setFulfillmentStatus("pending");
        order.setReceiverName(address.fullName());
        order.setReceiverPhone(address.phone());
        order.setShippingAddressLine(address.addressLine());
        order.setShippingWard(address.ward());
        order.setShippingDistrict(address.district());
        order.setShippingCity(address.city());
        order.setShippingProvince(address.province());
        order.setShippingPostalCode(address.postalCode());
        order.setShippingCountry(address.country() == null || address.country().isBlank() ? "Việt Nam" : address.country());
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
                    ProductSnapshotResponse snapshot = pricing.snapshotMap().get(lineKey(item.productId(), item.variantId()));
                    OrderItemEntity entity = new OrderItemEntity();
                    entity.setOrderId(savedOrder.getId());
                    entity.setProductId(item.productId());
                    entity.setVariantId(item.variantId());
                    entity.setProductName(snapshot.name());
                    entity.setVariantName(snapshot.variantName());
                    entity.setSku(snapshot.sku());
                    entity.setThumbnailUrl(snapshot.thumbnailUrl());
                    BigDecimal unitPrice = pricing.unitPrice(item);
                    entity.setUnitPrice(unitPrice);
                    entity.setQuantity(item.quantity());
                    entity.setLineTotal(unitPrice.multiply(BigDecimal.valueOf(item.quantity())).setScale(2, RoundingMode.HALF_UP));
                    entity.setCreatedAt(OffsetDateTime.now());
                    return entity;
                })
                .toList();

        orderItemRepository.saveAll(orderItems);
        inventoryService.reserve(savedOrder.getId(), request.items());
        var payment = paymentService.createInitialPayment(savedOrder, principal);
        if (!pricing.flashSaleReservationMap().isEmpty()) {
            flashSaleCheckoutService.confirmForOrder(userId, savedOrder.getId(), List.copyOf(pricing.flashSaleReservationMap().values()));
        }

        if (pricing.couponValidation() != null && pricing.couponValidation().coupon() != null) {
            consumeCouponAfterCommit(pricing.couponValidation().coupon().id(), savedOrder.getUserId(), savedOrder.getId());
        }

        outboxService.publish("ORDER", savedOrder.getId().toString(), "ORDER_CREATED",
                eventPayloadFactory.orderEvent("ORDER_CREATED", savedOrder, payment, principal));

        return orderQueryService.getInternal(savedOrder.getId());
    }

    private CheckoutPricing prepareCheckout(UUID userId, List<OrderLineRequest> items, String couponCode, String paymentMethod, Long shippingMethodId) {
        List<ProductSnapshotResponse> snapshots = catalogClient.getProductSnapshots(
                items.stream()
                        .map(item -> new ProductSnapshotRequest.ProductSnapshotLineRequest(item.productId(), item.variantId()))
                        .toList()
        );

        Map<String, ProductSnapshotResponse> snapshotMap = snapshots.stream()
                .collect(Collectors.toMap(
                        snapshot -> lineKey(snapshot.productId(), snapshot.variantId()),
                        Function.identity(),
                        (left, right) -> left
                ));

        items.forEach(item -> {
            ProductSnapshotResponse snapshot = snapshotMap.get(lineKey(item.productId(), item.variantId()));
            if (snapshot == null || !snapshot.active()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Product " + item.productId() + " is unavailable");
            }
        });

        Map<String, FlashSaleCheckoutReservation> flashSaleReservationMap = resolveFlashSaleReservations(userId, items);
        BigDecimal subtotal = items.stream()
                .map(item -> unitPrice(item, snapshotMap, flashSaleReservationMap).multiply(BigDecimal.valueOf(item.quantity())))
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

        ShippingMethodEntity shippingMethod = shippingMethodService.resolveActive(shippingMethodId);
        BigDecimal shippingFee = shippingMethod.getFee().setScale(2, RoundingMode.HALF_UP);
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
                validatePaymentMethod(normalizePaymentMethod(paymentMethod)),
                shippingMethod.getId(),
                shippingMethod.getName(),
                flashSaleReservationMap
        );
    }

    private Map<String, FlashSaleCheckoutReservation> resolveFlashSaleReservations(UUID userId, List<OrderLineRequest> items) {
        boolean hasFlashSaleReservation = items.stream()
                .anyMatch(item -> item.flashSaleReservationToken() != null && !item.flashSaleReservationToken().isBlank());
        if (!hasFlashSaleReservation) {
            return Map.of();
        }
        if (userId == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Authentication is required for flash sale checkout");
        }
        return flashSaleCheckoutService.resolveForPricing(userId, items).stream()
                .collect(Collectors.toMap(FlashSaleCheckoutReservation::reservationToken, Function.identity()));
    }

    private BigDecimal unitPrice(
            OrderLineRequest item,
            Map<String, ProductSnapshotResponse> snapshotMap,
            Map<String, FlashSaleCheckoutReservation> flashSaleReservationMap
    ) {
        String token = item.flashSaleReservationToken();
        if (token != null && !token.isBlank()) {
            FlashSaleCheckoutReservation reservation = flashSaleReservationMap.get(token.trim());
            if (reservation == null) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Flash sale reservation is invalid");
            }
            return reservation.salePrice();
        }
        return snapshotMap.get(lineKey(item.productId(), item.variantId())).price();
    }

    private static String lineKey(Long productId, Long variantId) {
        return productId + ":" + (variantId == null ? "" : variantId);
    }

    private String normalizePaymentMethod(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            return "COD";
        }

        return switch (paymentMethod.trim().toUpperCase()) {
            case PaymentConstants.METHOD_COD -> PaymentConstants.METHOD_COD;
            case "MEGAPAY", "MOMO" -> "MOMO";
            case "CARD" -> "CARD";
            case "BANK_TRANSFER" -> "BANK_TRANSFER";
            case "VNPAY" -> "VNPAY";
            case "PAYPAL" -> "PAYPAL";
            case PaymentConstants.METHOD_SEPAY_QR -> PaymentConstants.METHOD_SEPAY_QR;
            case PaymentConstants.METHOD_SEPAY_CHECKOUT -> PaymentConstants.METHOD_SEPAY_CHECKOUT;
            case PaymentConstants.METHOD_SEPAY_CARD -> PaymentConstants.METHOD_SEPAY_CARD;
            case PaymentConstants.METHOD_APPLE_PAY -> PaymentConstants.METHOD_APPLE_PAY;
            case PaymentConstants.METHOD_GOOGLE_PAY -> PaymentConstants.METHOD_GOOGLE_PAY;
            default -> throw new BusinessException(HttpStatus.BAD_REQUEST, "Unsupported payment method");
        };
    }

    private String normalizeClientRequestId(String clientRequestId) {
        if (clientRequestId == null || clientRequestId.isBlank()) {
            return null;
        }

        String normalized = clientRequestId.trim();
        if (!CLIENT_REQUEST_ID_PATTERN.matcher(normalized).matches()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Invalid client request id");
        }
        return normalized;
    }

    private String validatePaymentMethod(String paymentMethod) {
        if (PaymentConstants.METHOD_COD.equals(paymentMethod) || PaymentConstants.ONLINE_SEPAY_METHODS.contains(paymentMethod)
                || PaymentConstants.METHOD_APPLE_PAY.equals(paymentMethod) || PaymentConstants.METHOD_GOOGLE_PAY.equals(paymentMethod)) {
            if (!paymentMethodService.isEnabled(paymentMethod)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Payment method is not available");
            }
        }
        if (PaymentConstants.METHOD_APPLE_PAY.equals(paymentMethod) || PaymentConstants.METHOD_GOOGLE_PAY.equals(paymentMethod)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Payment method is prepared for future use but not implemented");
        }
        return paymentMethod;
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
            Map<String, ProductSnapshotResponse> snapshotMap,
            BigDecimal subtotal,
            BigDecimal tax,
            BigDecimal shippingFee,
            BigDecimal discount,
            BigDecimal total,
            CouponValidationResponse couponValidation,
            String paymentMethod,
            Long shippingMethodId,
            String shippingMethodName,
            Map<String, FlashSaleCheckoutReservation> flashSaleReservationMap
    ) {
        private Long couponId() {
            return couponValidation != null && couponValidation.coupon() != null ? couponValidation.coupon().id() : null;
        }

        private String couponCode() {
            return couponValidation != null && couponValidation.coupon() != null ? couponValidation.coupon().code() : null;
        }

        private OrderQuoteResponse toQuoteResponse() {
            return new OrderQuoteResponse(subtotal, tax, shippingFee, discount, total, paymentMethod, shippingMethodId, shippingMethodName, couponValidation);
        }

        private BigDecimal unitPrice(OrderLineRequest item) {
            String token = item.flashSaleReservationToken();
            if (token != null && !token.isBlank()) {
                FlashSaleCheckoutReservation reservation = flashSaleReservationMap.get(token.trim());
                if (reservation != null) {
                    return reservation.salePrice();
                }
            }
            return snapshotMap.get(lineKey(item.productId(), item.variantId())).price();
        }
    }
}
