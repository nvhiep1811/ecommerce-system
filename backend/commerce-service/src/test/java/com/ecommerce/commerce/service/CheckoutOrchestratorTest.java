package com.ecommerce.commerce.service;

import com.ecommerce.commerce.client.CatalogClient;
import com.ecommerce.commerce.client.UserClient;
import com.ecommerce.commerce.domain.OrderEntity;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
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
    private OrderQueryService orderQueryService;

    @Mock
    private OutboxService outboxService;

    @InjectMocks
    private CheckoutOrchestrator checkoutOrchestrator;

    @Test
    void quoteUsesBackendPricingRules() {
        OrderQuoteRequest request = new OrderQuoteRequest(
                null,
                "SAVE10",
                "megapay",
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
        assertEquals(new BigDecimal("5.00"), actual.shippingFee());
        assertEquals(new BigDecimal("3.57"), actual.discount());
        assertEquals(new BigDecimal("34.63"), actual.total());
        assertEquals("MOMO", actual.paymentMethod());
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
                new BigDecimal("5.00"),
                new BigDecimal("3.57"),
                new BigDecimal("34.63"),
                "unpaid",
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                null,
                List.of()
        );
        when(orderQueryService.getInternal(123L)).thenReturn(expectedResponse);

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
        assertEquals(new BigDecimal("5.00"), savedOrder.getShippingFee());
        assertEquals(new BigDecimal("3.57"), savedOrder.getDiscountAmount());
        assertEquals(new BigDecimal("34.63"), savedOrder.getGrandTotal());
        assertEquals(99L, savedOrder.getCouponId());
        assertEquals("SAVE10", savedOrder.getCouponCode());
        assertEquals("District 1", savedOrder.getShippingDistrict());
        assertEquals("Ben Nghe", savedOrder.getShippingWard());
        assertEquals("Vietnam", savedOrder.getShippingCountry());
        assertTrue(savedOrder.getOrderNo().startsWith("ORD-"));

        verify(orderItemRepository).saveAll(any());
        verify(inventoryService).reserve(123L, request.items());
        verify(paymentService).createInitialPayment(savedOrder);
        verify(catalogClient).consumeCoupon(99L, userId, 123L);

        ArgumentCaptor<Object> outboxPayloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(outboxService).publish(eq("ORDER"), eq("123"), eq("ORDER_CREATED"), outboxPayloadCaptor.capture());
        Map<?, ?> payload = (Map<?, ?>) outboxPayloadCaptor.getValue();
        assertEquals(123L, payload.get("orderId"));
        assertEquals(userId, payload.get("userId"));
        assertEquals(new BigDecimal("34.63"), payload.get("total"));
    }

    @Test
    void placeOrderRejectsUnavailableProductsBeforePersistingAnything() {
        UUID userId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(userId.toString(), "buyer@example.com", List.of("CUSTOMER"));
        PlaceOrderRequest request = new PlaceOrderRequest(
                10L,
                null,
                "COD",
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
}

