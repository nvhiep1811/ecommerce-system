package com.ecommerce.commerce.service;

import com.ecommerce.commerce.client.UserClient;
import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import com.ecommerce.commerce.dto.AddressSnapshotResponse;
import com.ecommerce.commerce.dto.OrderQuoteRequest;
import com.ecommerce.commerce.dto.OrderQuoteResponse;
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.dto.PlaceOrderRequest;
import com.ecommerce.commerce.observability.CommerceBusinessMetrics;
import com.ecommerce.commerce.repository.OrderItemRepository;
import com.ecommerce.commerce.repository.OrderRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionOperations;

import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class CheckoutOrchestrator {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final UserClient userClient;
    private final CheckoutPricingService checkoutPricingService;
    private final CheckoutValidationService checkoutValidationService;
    private final OrderFactory orderFactory;
    private final InventoryService inventoryService;
    private final OrderPaymentCreator orderPaymentCreator;
    private final FlashSaleCheckoutService flashSaleCheckoutService;
    private final CouponConsumptionService couponConsumptionService;
    private final OrderEventPublisher orderEventPublisher;
    private final OrderQueryService orderQueryService;
    private final TransactionOperations transactionOperations;
    private final CommerceBusinessMetrics businessMetrics;

    public CheckoutOrchestrator(
            OrderRepository orderRepository,
            OrderItemRepository orderItemRepository,
            UserClient userClient,
            CheckoutPricingService checkoutPricingService,
            CheckoutValidationService checkoutValidationService,
            OrderFactory orderFactory,
            InventoryService inventoryService,
            OrderPaymentCreator orderPaymentCreator,
            FlashSaleCheckoutService flashSaleCheckoutService,
            CouponConsumptionService couponConsumptionService,
            OrderEventPublisher orderEventPublisher,
            OrderQueryService orderQueryService,
            TransactionOperations transactionOperations,
            CommerceBusinessMetrics businessMetrics
    ) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.userClient = userClient;
        this.checkoutPricingService = checkoutPricingService;
        this.checkoutValidationService = checkoutValidationService;
        this.orderFactory = orderFactory;
        this.inventoryService = inventoryService;
        this.orderPaymentCreator = orderPaymentCreator;
        this.flashSaleCheckoutService = flashSaleCheckoutService;
        this.couponConsumptionService = couponConsumptionService;
        this.orderEventPublisher = orderEventPublisher;
        this.orderQueryService = orderQueryService;
        this.transactionOperations = transactionOperations;
        this.businessMetrics = businessMetrics;
    }

    @Transactional(readOnly = true)
    public OrderQuoteResponse quote(OrderQuoteRequest request) {
        return checkoutPricingService.prepare(
                null,
                request.items(),
                request.couponCode(),
                request.paymentMethod(),
                request.shippingMethodId()
        ).toQuoteResponse();
    }

    @Transactional(readOnly = true)
    public OrderQuoteResponse quote(AuthenticatedUser principal, OrderQuoteRequest request) {
        UUID userId = principal == null ? null : UUID.fromString(principal.userId());
        return checkoutPricingService.prepare(
                userId,
                request.items(),
                request.couponCode(),
                request.paymentMethod(),
                request.shippingMethodId()
        ).toQuoteResponse();
    }

    public OrderResponse placeOrder(AuthenticatedUser principal, PlaceOrderRequest request) {
        long startedNanos = businessMetrics.startTimer();
        boolean metricRecorded = false;
        UUID userId = UUID.fromString(principal.userId());
        String clientRequestId = checkoutValidationService.normalizeClientRequestId(request.clientRequestId());

        try {
            // Idempotency check trước transaction
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
                OrderResponse response = transactionOperations.execute(
                        status -> placeOrderInTransaction(principal, request, userId, clientRequestId)
                );
                businessMetrics.recordCheckout("created", request.paymentMethod(), startedNanos);
                metricRecorded = true;
                return response;
            } catch (DataIntegrityViolationException exception) {
                if (clientRequestId == null) {
                    businessMetrics.recordCheckout("failed", request.paymentMethod(), startedNanos);
                    metricRecorded = true;
                    throw exception;
                }
                // Race condition: idempotency key vừa được insert bởi request khác
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
        // Idempotency check trong transaction (double-check)
        if (clientRequestId != null) {
            var existingOrder = orderRepository.findByUserIdAndClientRequestId(userId, clientRequestId);
            if (existingOrder.isPresent()) {
                return orderQueryService.getInternal(existingOrder.get().getId());
            }
        }

        // 1. Lấy address snapshot
        AddressSnapshotResponse address = userClient.getAddress(request.addressId());

        // 2. Tính pricing
        CheckoutPricing pricing = checkoutPricingService.prepare(
                userId,
                request.items(),
                request.couponCode(),
                request.paymentMethod(),
                request.shippingMethodId()
        );

        // 3. Build và save order
        OrderEntity order = orderFactory.buildOrder(userId, clientRequestId, address, pricing);
        OrderEntity savedOrder = orderRepository.save(order);

        // 4. Build và save order items
        orderItemRepository.saveAll(
                orderFactory.buildOrderItems(savedOrder.getId(), request.items(), pricing)
        );

        // 5. Reserve inventory
        inventoryService.reserve(savedOrder.getId(), request.items());

        // 6. Tạo payment
        PaymentEntity payment = orderPaymentCreator.createInitialPayment(savedOrder, principal);

        // 7. Confirm flash sale reservation nếu có
        if (!pricing.flashSaleReservationMap().isEmpty()) {
            flashSaleCheckoutService.confirmForOrder(
                    userId,
                    savedOrder.getId(),
                    List.copyOf(pricing.flashSaleReservationMap().values())
            );
        }

        // 8. Consume coupon sau commit
        if (pricing.couponValidation() != null && pricing.couponValidation().coupon() != null) {
            couponConsumptionService.consumeAfterCommit(
                    pricing.couponValidation().coupon().id(),
                    savedOrder.getUserId(),
                    savedOrder.getId()
            );
        }

        // 9. Publish outbox event
        orderEventPublisher.publishOrderCreated(savedOrder, payment, principal);

        return orderQueryService.getInternal(savedOrder.getId());
    }
}