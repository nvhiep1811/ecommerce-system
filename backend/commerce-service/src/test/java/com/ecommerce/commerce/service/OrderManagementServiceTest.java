package com.ecommerce.commerce.service;

import com.ecommerce.commerce.domain.OrderEntity;
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.repository.OrderRepository;
import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.web.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderManagementServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private InventoryService inventoryService;

    @Mock
    private PaymentService paymentService;

    @Mock
    private FlashSaleCheckoutService flashSaleCheckoutService;

    @Mock
    private OrderQueryService orderQueryService;

    @Mock
    private OutboxService outboxService;

    @Mock
    private OrderEventPayloadFactory eventPayloadFactory;

    @Spy
    private OrderStateMachine orderStateMachine = new OrderStateMachine();

    private OrderManagementService orderManagementService;

    @BeforeEach
    void setUp() {
        OrderEventPublisher orderEventPublisher = new OrderEventPublisher(outboxService, eventPayloadFactory);
        orderManagementService = new OrderManagementService(
                orderRepository,
                inventoryService,
                paymentService,
                flashSaleCheckoutService,
                orderQueryService,
                orderEventPublisher,
                orderStateMachine
        );
    }

    @Test
    void updateStatusRejectsSellerWithoutOwnershipOnOrder() {
        UUID sellerId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(sellerId.toString(), "seller@example.com", List.of("SELLER"));
        OrderEntity order = new OrderEntity();
        order.setId(55L);

        when(orderRepository.findById(55L)).thenReturn(Optional.of(order));
        when(orderRepository.existsSellerOrder(sellerId, 55L)).thenReturn(false);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> orderManagementService.updateStatus(principal, 55L, "confirmed")
        );

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatus());
        assertEquals("You can only update orders containing your products", exception.getMessage());
        verify(orderRepository, never()).save(any(OrderEntity.class));
        verifyNoInteractions(inventoryService, paymentService, orderQueryService, outboxService);
    }

    @Test
    void updateStatusMarksCodOrderAsPaidWhenDelivered() {
        UUID sellerId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(sellerId.toString(), "seller@example.com", List.of("SELLER"));
        OrderEntity order = new OrderEntity();
        order.setId(77L);
        order.setPaymentMethodCode("COD");
        order.setOrderStatus("shipping");
        order.setPaymentStatus("unpaid");
        order.setFulfillmentStatus("shipping");
        when(orderRepository.findById(77L)).thenReturn(Optional.of(order));
        when(orderRepository.existsSellerOrder(sellerId, 77L)).thenReturn(true);

        OrderResponse expectedResponse = new OrderResponse(
                77L,
                "ORD-77",
                UUID.randomUUID(),
                "delivered",
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                null,
                null,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                "paid",
                "COD",
                "NONE",
                null,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                null,
                List.of()
        );
        when(orderQueryService.getInternal(77L)).thenReturn(expectedResponse);
        when(eventPayloadFactory.statusChanged(eq(order), eq("delivered"), eq(principal)))
                .thenReturn(Map.of("status", "delivered"));

        OrderResponse actual = orderManagementService.updateStatus(principal, 77L, "delivered");

        assertSame(expectedResponse, actual);

        ArgumentCaptor<OrderEntity> orderCaptor = ArgumentCaptor.forClass(OrderEntity.class);
        verify(orderRepository).save(orderCaptor.capture());
        OrderEntity savedOrder = orderCaptor.getValue();
        assertEquals("delivered", savedOrder.getOrderStatus());
        assertEquals("delivered", savedOrder.getFulfillmentStatus());
        assertEquals("paid", savedOrder.getPaymentStatus());
        assertNotNull(savedOrder.getDeliveredAt());
        assertNotNull(savedOrder.getPaidAt());

        verify(paymentService).markPaid(77L);
        verify(outboxService).publish(eq("ORDER"), eq("77"), eq("ORDER_STATUS_CHANGED"), any());
    }

    @Test
    void updateStatusNormalizesShippedAliasToShipping() {
        UUID sellerId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(sellerId.toString(), "seller@example.com", List.of("SELLER"));
        OrderEntity order = new OrderEntity();
        order.setId(91L);
        order.setPaymentMethodCode("CARD");
        order.setOrderStatus("confirmed");
        order.setFulfillmentStatus("pending");
        when(orderRepository.findById(91L)).thenReturn(Optional.of(order));
        when(orderRepository.existsSellerOrder(sellerId, 91L)).thenReturn(true);

        OrderResponse expectedResponse = new OrderResponse(
                91L,
                "ORD-91",
                UUID.randomUUID(),
                "shipped",
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                null,
                null,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                "unpaid",
                "CARD",
                "NONE",
                null,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                null,
                List.of()
        );
        when(orderQueryService.getInternal(91L)).thenReturn(expectedResponse);
        when(eventPayloadFactory.statusChanged(eq(order), eq("shipping"), eq(principal)))
                .thenReturn(Map.of("status", "shipping"));

        OrderResponse actual = orderManagementService.updateStatus(principal, 91L, "shipped");

        assertSame(expectedResponse, actual);

        ArgumentCaptor<Object> outboxPayloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(outboxService).publish(eq("ORDER"), eq("91"), eq("ORDER_STATUS_CHANGED"), outboxPayloadCaptor.capture());
        Map<?, ?> payload = (Map<?, ?>) outboxPayloadCaptor.getValue();
        assertEquals("shipping", payload.get("status"));

        verify(orderRepository).save(order);
        assertEquals("shipping", order.getOrderStatus());
        assertEquals("shipping", order.getFulfillmentStatus());
        verify(paymentService, never()).markPaid(anyLong());
    }

    @Test
    void updateStatusRejectsConfirmingOnlineOrderBeforePaymentIsPaid() {
        UUID sellerId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(sellerId.toString(), "seller@example.com", List.of("SELLER"));
        OrderEntity order = new OrderEntity();
        order.setId(92L);
        order.setPaymentMethodCode(PaymentConstants.METHOD_SEPAY_QR);
        order.setOrderStatus(PaymentConstants.ORDER_PENDING_PAYMENT);
        order.setPaymentStatus(PaymentConstants.PAYMENT_PENDING);
        when(orderRepository.findById(92L)).thenReturn(Optional.of(order));
        when(orderRepository.existsSellerOrder(sellerId, 92L)).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> orderManagementService.updateStatus(principal, 92L, "confirmed")
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatus());
        assertEquals("Online payment must be paid before confirming order", exception.getMessage());
        verify(inventoryService, never()).confirmReservations(anyLong());
        verify(orderRepository, never()).save(any(OrderEntity.class));
        verify(outboxService, never()).publish(any(), any(), any(), any());
    }

    @Test
    void cancelShouldRestoreInventoryAndCancelOpenPayment() {
        UUID sellerId = UUID.randomUUID();
        AuthenticatedUser principal = new AuthenticatedUser(sellerId.toString(), "seller@example.com", List.of("SELLER"));
        OrderEntity order = new OrderEntity();
        order.setId(93L);
        order.setPaymentMethodCode(PaymentConstants.METHOD_COD);
        order.setOrderStatus(PaymentConstants.ORDER_PENDING);
        order.setPaymentStatus(PaymentConstants.PAYMENT_UNPAID);
        order.setFulfillmentStatus("pending");
        when(orderRepository.findById(93L)).thenReturn(Optional.of(order));
        when(orderRepository.existsSellerOrder(sellerId, 93L)).thenReturn(true);

        OrderResponse expectedResponse = new OrderResponse(
                93L,
                "ORD-93",
                UUID.randomUUID(),
                "cancelled",
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                null,
                null,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                "cancelled",
                "COD",
                "NONE",
                null,
                OffsetDateTime.now(),
                OffsetDateTime.now(),
                null,
                List.of()
        );
        when(orderQueryService.getInternal(93L)).thenReturn(expectedResponse);
        when(eventPayloadFactory.statusChanged(eq(order), eq("cancelled"), eq(principal)))
                .thenReturn(Map.of("status", "cancelled"));

        OrderResponse actual = orderManagementService.cancel(principal, 93L);

        assertSame(expectedResponse, actual);
        assertEquals("cancelled", order.getOrderStatus());
        assertEquals("cancelled", order.getPaymentStatus());
        assertEquals("cancelled", order.getFulfillmentStatus());
        assertNotNull(order.getCancelledAt());
        verify(inventoryService).cancelReservations(93L);
        verify(flashSaleCheckoutService).releaseConfirmedForOrder(93L);
        verify(paymentService).cancelOpenPayment(eq(93L), eq("Order cancelled before fulfillment"));
        verify(outboxService).publish(eq("ORDER"), eq("93"), eq("ORDER_STATUS_CHANGED"), any());
    }
}
