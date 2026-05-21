package com.ecommerce.commerce.service;

import com.ecommerce.commerce.client.CatalogClient;
import com.ecommerce.commerce.client.UserClient;
import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.domain.PaymentEntity;
import com.ecommerce.commerce.domain.ShippingMethodEntity;
import com.ecommerce.commerce.dto.AddressSnapshotResponse;
import com.ecommerce.commerce.dto.CouponPayload;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionOperations;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CheckoutOrchestratorTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private OrderItemRepository orderItemRepository;

    @Mock
    private UserClient userClient;

    @Mock
    private CatalogClient catalogClient;

    @Mock
    private InventoryService inventoryService;

    @Mock
    private PaymentService paymentService;

    @Mock
    private PaymentMethodService paymentMethodService;

    @Mock
    private ShippingMethodService shippingMethodService;

    @Mock
    private OrderQueryService orderQueryService;

    @Mock
    private OutboxService outboxService;

    @Mock
    private OrderEventPayloadFactory eventPayloadFactory;

    @Mock
    private TransactionOperations transactionOperations;

    @Mock
    private TransactionStatus transactionStatus;

    @InjectMocks
    private CheckoutOrchestrator checkoutOrchestrator;

    @BeforeEach
    void setUpShippingMethod() {
        lenient().when(shippingMethodService.resolveActive(nullable(Long.class))).thenReturn(standardShippingMethod());
        lenient().when(transactionOperations.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(transactionStatus);
        });
    }

    @Test
    void quoteUsesBackendPricingRules() {
        OrderQuoteRequest request = new OrderQuoteRequest(
                null,
                "SAVE10",
                "megapay",
                null,
                List.of(
                        new OrderLineRequest(100L, null, 2),
                        new OrderLineRequest(200L, null, 1)
                )
        );

        when(catalogClient.getProductSnapshots(anyList())).thenReturn(List.of(
                new ProductSnapshotResponse(100L, "Apple", "SKU-100", "apple.jpg", new BigDecimal("12.34"), UUID.randomUUID(), true),
                new ProductSnapshotResponse(200L, "Orange", "SKU-200", "orange.jpg", new BigDecimal("5.50"), UUID.randomUUID(), true)
        ));
        when(catalogClient.validateCoupon("SAVE10", new BigDecimal("30.18"))).thenReturn(
                new CouponValidationResponse(true, new BigDecimal("3.57"), "Coupon applied", new CouponPayload(99L, "SAVE10"))
        );

        OrderQuoteResponse actual = checkoutOrchestrator.quote(request);

        assertEquals(new BigDecimal("30.18"), actual.subtotal());
        assertEquals(new BigDecimal("3.02"), actual.tax());
        assertEquals(new BigDecimal("30000.00"), actual.shippingFee());
        assertEquals(new BigDecimal("3.57"), actual.discount());
        assertEquals(new BigDecimal("30029.63"), actual.total());
        assertEquals("MOMO", actual.paymentMethod());
        assertEquals(1L, actual.shippingMethodId());
        assertEquals("Giao hang tieu chuan", actual.shippingMethodName());
        assertEquals("SAVE10", actual.coupon().coupon().code());

        verifyNoInteractions(userClient, orderRepository, orderItemRepository, inventoryService, paymentService, orderQueryService, outboxService);
    }

    @Test
    void placeOrderCreatesPendingOrderAndTriggersDownstreamWork() {
        UUID userId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(userId.toString(), "buyer@example.com", List.of("CUSTOMER"));
        PlaceOrderRequest request = new PlaceOrderRequest(
                10L,
                "SAVE10",
                "megapay",
                null,
                List.of(
                        new OrderLineRequest(100L, null, 2),
                        new OrderLineRequest(200L, null, 1)
                )
        );

        when(userClient.getAddress(10L)).thenReturn(new AddressSnapshotResponse(
                10L,
                userId,
                "Nguyen Van A",
                "0900000000",
                "123 Le Loi",
                "Ben Nghe",
                "District 1",
                "Ho Chi Minh City",
                "Ho Chi Minh",
                "700000",
                "Vietnam",
                true
        ));
        when(catalogClient.getProductSnapshots(anyList())).thenReturn(List.of(
                new ProductSnapshotResponse(100L, "Apple", "SKU-100", "apple.jpg", new BigDecimal("12.34"), UUID.randomUUID(), true),
                new ProductSnapshotResponse(200L, "Orange", "SKU-200", "orange.jpg", new BigDecimal("5.50"), UUID.randomUUID(), true)
        ));
        when(catalogClient.validateCoupon("SAVE10", new BigDecimal("30.18"))).thenReturn(
                new CouponValidationResponse(true, new BigDecimal("3.57"), "Coupon applied", new CouponPayload(99L, "SAVE10"))
        );
        when(orderRepository.save(any(OrderEntity.class))).thenAnswer(invocation -> {
            OrderEntity order = invocation.getArgument(0);
            order.setId(123L);
            return order;
        });

        OrderResponse expectedResponse = new OrderResponse(
                123L,
                "ORD-TEST",
                userId,
                "pending",
                new BigDecimal("30.18"),
                new BigDecimal("3.02"),
                1L,
                "Giao hang tieu chuan",
                new BigDecimal("30000.00"),
                new BigDecimal("3.57"),
                new BigDecimal("30029.63"),
                "unpaid",
                "MOMO",
                "NONE",
                null,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                null,
                List.of()
        );
        when(orderQueryService.getInternal(123L)).thenReturn(expectedResponse);
        PaymentEntity payment = new PaymentEntity();
        payment.setStatus("pending");
        when(paymentService.createInitialPayment(any(OrderEntity.class), eq(principal))).thenReturn(payment);
        Map<String, Object> orderCreatedPayload = Map.of(
                "orderId", 123L,
                "userId", userId,
                "totalAmount", new BigDecimal("30029.63")
        );
        when(eventPayloadFactory.orderEvent(eq("ORDER_CREATED"), any(OrderEntity.class), eq(payment), eq(principal)))
                .thenReturn(orderCreatedPayload);

        OrderResponse actual = checkoutOrchestrator.placeOrder(principal, request);

        assertSame(expectedResponse, actual);

        ArgumentCaptor<OrderEntity> orderCaptor = ArgumentCaptor.forClass(OrderEntity.class);
        verify(orderRepository).save(orderCaptor.capture());
        OrderEntity savedOrder = orderCaptor.getValue();
        assertEquals(userId, savedOrder.getUserId());
        assertEquals("MOMO", savedOrder.getPaymentMethodCode());
        assertEquals("pending", savedOrder.getOrderStatus());
        assertEquals("unpaid", savedOrder.getPaymentStatus());
        assertEquals(new BigDecimal("30.18"), savedOrder.getSubtotal());
        assertEquals(new BigDecimal("3.02"), savedOrder.getTaxAmount());
        assertEquals(new BigDecimal("30000.00"), savedOrder.getShippingFee());
        assertEquals(new BigDecimal("3.57"), savedOrder.getDiscountAmount());
        assertEquals(new BigDecimal("30029.63"), savedOrder.getGrandTotal());
        assertEquals(99L, savedOrder.getCouponId());
        assertEquals("SAVE10", savedOrder.getCouponCode());
        assertEquals(1L, savedOrder.getShippingMethodId());
        assertEquals("Giao hang tieu chuan", savedOrder.getShippingMethodName());
        assertEquals("District 1", savedOrder.getShippingDistrict());
        assertEquals("Ben Nghe", savedOrder.getShippingWard());
        assertEquals("Vietnam", savedOrder.getShippingCountry());
        assertTrue(savedOrder.getOrderNo().startsWith("ORD-"));

        verify(orderItemRepository).saveAll(any());
        verify(inventoryService).reserve(123L, request.items());
        verify(paymentService).createInitialPayment(savedOrder, principal);
        verify(catalogClient).consumeCoupon(99L, userId, 123L);

        ArgumentCaptor<Object> outboxPayloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(outboxService).publish(eq("ORDER"), eq("123"), eq("ORDER_CREATED"), outboxPayloadCaptor.capture());
        Map<?, ?> payload = (Map<?, ?>) outboxPayloadCaptor.getValue();
        assertEquals(123L, payload.get("orderId"));
        assertEquals(userId, payload.get("userId"));
        assertEquals(new BigDecimal("30029.63"), payload.get("totalAmount"));
    }

    @Test
    void createOrderWithoutPaymentMethodShouldDefaultToCodForBackwardCompatibility() {
        UUID userId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(userId.toString(), "buyer@example.com", List.of("CUSTOMER"));
        PlaceOrderRequest request = new PlaceOrderRequest(
                10L,
                null,
                null,
                null,
                List.of(new OrderLineRequest(100L, null, 1))
        );
        when(paymentMethodService.isEnabled("COD")).thenReturn(true);
        when(userClient.getAddress(10L)).thenReturn(address(userId));
        when(catalogClient.getProductSnapshots(anyList())).thenReturn(List.of(
                new ProductSnapshotResponse(100L, "Apple", "SKU-100", "apple.jpg", new BigDecimal("12.34"), UUID.randomUUID(), true)
        ));
        when(orderRepository.save(any(OrderEntity.class))).thenAnswer(invocation -> {
            OrderEntity order = invocation.getArgument(0);
            order.setId(124L);
            return order;
        });
        PaymentEntity payment = new PaymentEntity();
        payment.setStatus("pending");
        when(paymentService.createInitialPayment(any(OrderEntity.class), eq(principal))).thenReturn(payment);
        when(eventPayloadFactory.orderEvent(eq("ORDER_CREATED"), any(OrderEntity.class), eq(payment), eq(principal)))
                .thenReturn(Map.of("orderId", 124L));
        OrderResponse expectedResponse = new OrderResponse(
                124L,
                "ORD-TEST",
                userId,
                "pending",
                new BigDecimal("12.34"),
                new BigDecimal("1.23"),
                1L,
                "Giao hang tieu chuan",
                new BigDecimal("30000.00"),
                BigDecimal.ZERO,
                new BigDecimal("30013.57"),
                "unpaid",
                "COD",
                "WAIT_FOR_SELLER_CONFIRMATION",
                null,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                null,
                List.of()
        );
        when(orderQueryService.getInternal(124L)).thenReturn(expectedResponse);

        OrderResponse actual = checkoutOrchestrator.placeOrder(principal, request);

        assertSame(expectedResponse, actual);
        ArgumentCaptor<OrderEntity> orderCaptor = ArgumentCaptor.forClass(OrderEntity.class);
        verify(orderRepository).save(orderCaptor.capture());
        assertEquals("COD", orderCaptor.getValue().getPaymentMethodCode());
        assertEquals("pending", orderCaptor.getValue().getOrderStatus());
        assertEquals("unpaid", orderCaptor.getValue().getPaymentStatus());
    }

    @Test
    void placeOrderWithSameClientRequestIdShouldReturnExistingOrderWithoutDuplicatingWork() {
        UUID userId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(userId.toString(), "buyer@example.com", List.of("CUSTOMER"));
        PlaceOrderRequest request = new PlaceOrderRequest(
                10L,
                null,
                "COD",
                null,
                List.of(new OrderLineRequest(100L, null, 1)),
                "checkout-abc123"
        );
        OrderEntity existingOrder = new OrderEntity();
        existingOrder.setId(777L);
        existingOrder.setUserId(userId);
        existingOrder.setClientRequestId("checkout-abc123");
        OrderResponse expectedResponse = new OrderResponse(
                777L,
                "ORD-EXISTING",
                userId,
                "pending",
                new BigDecimal("12.34"),
                new BigDecimal("1.23"),
                1L,
                "Giao hang tieu chuan",
                new BigDecimal("30000.00"),
                BigDecimal.ZERO,
                new BigDecimal("30013.57"),
                "unpaid",
                "COD",
                "WAIT_FOR_SELLER_CONFIRMATION",
                null,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                null,
                List.of()
        );

        when(orderRepository.findByUserIdAndClientRequestId(userId, "checkout-abc123"))
                .thenReturn(Optional.of(existingOrder));
        when(orderQueryService.getInternal(777L)).thenReturn(expectedResponse);

        OrderResponse actual = checkoutOrchestrator.placeOrder(principal, request);

        assertSame(expectedResponse, actual);
        verify(orderRepository, never()).save(any(OrderEntity.class));
        verifyNoInteractions(userClient, catalogClient, orderItemRepository, inventoryService, paymentService, outboxService);
    }

    @Test
    void placeOrderWithSameClientRequestIdShouldReturnExistingOrderWhenUniqueConstraintWinsRace() {
        UUID userId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(userId.toString(), "buyer@example.com", List.of("CUSTOMER"));
        PlaceOrderRequest request = new PlaceOrderRequest(
                10L,
                null,
                "COD",
                null,
                List.of(new OrderLineRequest(100L, null, 1)),
                "checkout-race-1"
        );
        OrderEntity existingOrder = new OrderEntity();
        existingOrder.setId(778L);
        existingOrder.setUserId(userId);
        existingOrder.setClientRequestId("checkout-race-1");
        OrderResponse expectedResponse = new OrderResponse(
                778L,
                "ORD-RACE",
                userId,
                "pending",
                new BigDecimal("12.34"),
                new BigDecimal("1.23"),
                1L,
                "Giao hang tieu chuan",
                new BigDecimal("30000.00"),
                BigDecimal.ZERO,
                new BigDecimal("30013.57"),
                "unpaid",
                "COD",
                "WAIT_FOR_SELLER_CONFIRMATION",
                null,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                null,
                List.of()
        );

        when(orderRepository.findByUserIdAndClientRequestId(userId, "checkout-race-1"))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(existingOrder));
        doThrow(new DataIntegrityViolationException("uq_orders_user_client_request"))
                .when(transactionOperations).execute(any());
        when(orderQueryService.getInternal(778L)).thenReturn(expectedResponse);

        OrderResponse actual = checkoutOrchestrator.placeOrder(principal, request);

        assertSame(expectedResponse, actual);
        verify(orderQueryService).getInternal(778L);
        verifyNoInteractions(userClient, catalogClient, orderItemRepository, inventoryService, paymentService, outboxService);
    }

    @Test
    void placeOrderShouldStopBeforePaymentWhenInventoryReservationLosesRace() {
        UUID userId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(userId.toString(), "buyer@example.com", List.of("CUSTOMER"));
        PlaceOrderRequest request = new PlaceOrderRequest(
                10L,
                null,
                "COD",
                null,
                List.of(new OrderLineRequest(100L, null, 1))
        );
        BusinessException stockConflict = new BusinessException(HttpStatus.CONFLICT, "Insufficient stock for product 100");

        when(paymentMethodService.isEnabled("COD")).thenReturn(true);
        when(userClient.getAddress(10L)).thenReturn(address(userId));
        when(catalogClient.getProductSnapshots(anyList())).thenReturn(List.of(
                new ProductSnapshotResponse(100L, "Apple", "SKU-100", "apple.jpg", new BigDecimal("12.34"), UUID.randomUUID(), true)
        ));
        when(orderRepository.save(any(OrderEntity.class))).thenAnswer(invocation -> {
            OrderEntity order = invocation.getArgument(0);
            order.setId(126L);
            return order;
        });
        doThrow(stockConflict).when(inventoryService).reserve(eq(126L), eq(request.items()));

        BusinessException actual = assertThrows(
                BusinessException.class,
                () -> checkoutOrchestrator.placeOrder(principal, request)
        );

        assertSame(stockConflict, actual);
        verify(orderItemRepository).saveAll(any());
        verify(paymentService, never()).createInitialPayment(any(), any());
        verify(outboxService, never()).publish(any(), any(), any(), any());
    }

    @Test
    void createOrderWithSepayQrShouldCreatePendingPaymentOrder() {
        UUID userId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(userId.toString(), "buyer@example.com", List.of("CUSTOMER"));
        PlaceOrderRequest request = new PlaceOrderRequest(
                10L,
                null,
                "SEPAY_QR",
                null,
                List.of(new OrderLineRequest(100L, null, 1))
        );
        when(paymentMethodService.isEnabled("SEPAY_QR")).thenReturn(true);
        when(userClient.getAddress(10L)).thenReturn(address(userId));
        when(catalogClient.getProductSnapshots(anyList())).thenReturn(List.of(
                new ProductSnapshotResponse(100L, "Apple", "SKU-100", "apple.jpg", new BigDecimal("12.34"), UUID.randomUUID(), true)
        ));
        when(orderRepository.save(any(OrderEntity.class))).thenAnswer(invocation -> {
            OrderEntity order = invocation.getArgument(0);
            order.setId(125L);
            return order;
        });
        PaymentEntity payment = new PaymentEntity();
        payment.setStatus("pending");
        when(paymentService.createInitialPayment(any(OrderEntity.class), eq(principal))).thenReturn(payment);
        when(eventPayloadFactory.orderEvent(eq("ORDER_CREATED"), any(OrderEntity.class), eq(payment), eq(principal)))
                .thenReturn(Map.of("orderId", 125L));
        OrderResponse expectedResponse = new OrderResponse(
                125L,
                "ORD-TEST",
                userId,
                "pending_payment",
                new BigDecimal("12.34"),
                new BigDecimal("1.23"),
                1L,
                "Giao hang tieu chuan",
                new BigDecimal("30000.00"),
                BigDecimal.ZERO,
                new BigDecimal("30013.57"),
                "pending",
                "SEPAY_QR",
                "SHOW_QR",
                null,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                null,
                List.of()
        );
        when(orderQueryService.getInternal(125L)).thenReturn(expectedResponse);

        OrderResponse actual = checkoutOrchestrator.placeOrder(principal, request);

        assertSame(expectedResponse, actual);
        ArgumentCaptor<OrderEntity> orderCaptor = ArgumentCaptor.forClass(OrderEntity.class);
        verify(orderRepository).save(orderCaptor.capture());
        assertEquals("SEPAY_QR", orderCaptor.getValue().getPaymentMethodCode());
        assertEquals("pending_payment", orderCaptor.getValue().getOrderStatus());
        assertEquals("pending", orderCaptor.getValue().getPaymentStatus());
    }

    @Test
    void placeOrderRejectsUnavailableProductsBeforePersistingAnything() {
        UUID userId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(userId.toString(), "buyer@example.com", List.of("CUSTOMER"));
        PlaceOrderRequest request = new PlaceOrderRequest(
                10L,
                null,
                "COD",
                null,
                List.of(new OrderLineRequest(100L, null, 1))
        );

        when(userClient.getAddress(10L)).thenReturn(new AddressSnapshotResponse(
                10L,
                userId,
                "Nguyen Van B",
                "0900000001",
                "456 Hai Ba Trung",
                "Cua Nam",
                "Hoan Kiem",
                "Ha Noi",
                "Ha Noi",
                "100000",
                "Vietnam",
                true
        ));
        when(catalogClient.getProductSnapshots(List.of(100L))).thenReturn(List.of(
                new ProductSnapshotResponse(100L, "Hidden Product", "SKU-100", "hidden.jpg", new BigDecimal("19.99"), UUID.randomUUID(), false)
        ));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> checkoutOrchestrator.placeOrder(principal, request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        assertEquals("Product 100 is unavailable", exception.getMessage());
        verify(orderRepository, never()).save(any(OrderEntity.class));
        verify(orderItemRepository, never()).saveAll(any());
        verifyNoInteractions(inventoryService, paymentService, orderQueryService, outboxService);
    }

    private AddressSnapshotResponse address(UUID userId) {
        return new AddressSnapshotResponse(
                10L,
                userId,
                "Nguyen Van A",
                "0900000000",
                "123 Le Loi",
                "Ben Nghe",
                "District 1",
                "Ho Chi Minh City",
                "Ho Chi Minh",
                "700000",
                "Vietnam",
                true
        );
    }

    private ShippingMethodEntity standardShippingMethod() {
        ShippingMethodEntity method = new ShippingMethodEntity();
        method.setId(1L);
        method.setName("Giao hang tieu chuan");
        method.setDescription("Standard shipping");
        method.setEstimatedMinDays(2);
        method.setEstimatedMaxDays(4);
        method.setFee(new BigDecimal("30000.00"));
        method.setActive(true);
        return method;
    }
}

