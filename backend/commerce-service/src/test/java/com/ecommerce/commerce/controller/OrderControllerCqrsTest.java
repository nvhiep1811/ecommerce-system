package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.command.*;
import com.ecommerce.commerce.query.*;
import com.ecommerce.commerce.dto.*;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderControllerCqrsTest {

    @Mock
    private Authentication authentication;

    private AuthenticatedUser principal;

    // Command Handlers
    @Mock
    private QuoteOrderCommandHandler quoteOrderCommandHandler;
    @Mock
    private PlaceOrderCommandHandler placeOrderCommandHandler;
    @Mock
    private UpdateOrderStatusCommandHandler updateOrderStatusCommandHandler;
    @Mock
    private AdvanceOrderCommandHandler advanceOrderCommandHandler;
    @Mock
    private CancelOrderCommandHandler cancelOrderCommandHandler;

    // Query Handlers
    @Mock
    private GetMyOrdersQueryHandler getMyOrdersQueryHandler;
    @Mock
    private GetSellerOrdersQueryHandler getSellerOrdersQueryHandler;
    @Mock
    private GetAdminOrdersQueryHandler getAdminOrdersQueryHandler;
    @Mock
    private GetOrderDetailQueryHandler getOrderDetailQueryHandler;
    @Mock
    private GetOrderPaymentStatusQueryHandler getOrderPaymentStatusQueryHandler;

    private OrderCommandController commandController;
    private OrderQueryController queryController;
    private AdminOrderQueryController adminOrderQueryController;

    @BeforeEach
    void setUp() {
        principal = new AuthenticatedUser("user-123", "user@example.com", Collections.emptyList());
        when(authentication.getPrincipal()).thenReturn(principal);

        commandController = new OrderCommandController(
                quoteOrderCommandHandler,
                placeOrderCommandHandler,
                updateOrderStatusCommandHandler,
                advanceOrderCommandHandler,
                cancelOrderCommandHandler
        );

        queryController = new OrderQueryController(
                getMyOrdersQueryHandler,
                getSellerOrdersQueryHandler,
//                getAdminOrdersQueryHandler,
                getOrderDetailQueryHandler,
                getOrderPaymentStatusQueryHandler
        );

        adminOrderQueryController = new AdminOrderQueryController(getAdminOrdersQueryHandler);
    }

    @Test
    void quoteShouldDelegateToHandler() {
        OrderQuoteRequest request = new OrderQuoteRequest(null, null, null, null, null);
        OrderQuoteResponse expectedResponse = new OrderQuoteResponse(null, null, null, null, null, null, null, null, null);
        when(quoteOrderCommandHandler.handle(any(QuoteOrderCommand.class))).thenReturn(expectedResponse);

        OrderQuoteResponse actualResponse = commandController.quote(authentication, request);
        assertSame(expectedResponse, actualResponse);
    }

    @Test
    void placeOrderShouldDelegateToHandler() {
        PlaceOrderRequest request = new PlaceOrderRequest(null, null, null, null, null, null);
        OrderResponse expectedResponse = orderResponse();
        when(placeOrderCommandHandler.handle(any(PlaceOrderCommand.class))).thenReturn(expectedResponse);

        OrderResponse actualResponse = commandController.placeOrder(authentication, request);
        assertSame(expectedResponse, actualResponse);
    }

    @Test
    void updateStatusShouldDelegateToHandler() {
        OrderStatusUpdateRequest request = new OrderStatusUpdateRequest("SHIPPED");
        OrderResponse expectedResponse = orderResponse();
        when(updateOrderStatusCommandHandler.handle(any(UpdateOrderStatusCommand.class))).thenReturn(expectedResponse);

        OrderResponse actualResponse = commandController.updateStatus(authentication, 1L, request);
        assertSame(expectedResponse, actualResponse);
    }

    @Test
    void advanceShouldDelegateToHandler() {
        OrderResponse expectedResponse = orderResponse();
        when(advanceOrderCommandHandler.handle(any(AdvanceOrderCommand.class))).thenReturn(expectedResponse);

        OrderResponse actualResponse = commandController.advance(authentication, 1L);
        assertSame(expectedResponse, actualResponse);
    }

    @Test
    void cancelShouldDelegateToHandler() {
        OrderResponse expectedResponse = orderResponse();
        when(cancelOrderCommandHandler.handle(any(CancelOrderCommand.class))).thenReturn(expectedResponse);

        OrderResponse actualResponse = commandController.cancel(authentication, 1L);
        assertSame(expectedResponse, actualResponse);
    }

    @Test
    void mineShouldDelegateToHandler() {
        List<OrderResponse> expectedList = Collections.emptyList();
        when(getMyOrdersQueryHandler.handle(any(GetMyOrdersQuery.class))).thenReturn(expectedList);

        List<OrderResponse> actualList = queryController.mine(authentication, "PENDING");
        assertSame(expectedList, actualList);
    }

    @Test
    void sellerShouldDelegateToHandler() {
        List<OrderResponse> expectedList = Collections.emptyList();
        when(getSellerOrdersQueryHandler.handle(any(GetSellerOrdersQuery.class))).thenReturn(expectedList);

        List<OrderResponse> actualList = queryController.seller(authentication, "PENDING");
        assertSame(expectedList, actualList);
    }

//    @Test
//    void adminShouldDelegateToHandler() {
//        List<OrderResponse> expectedList = Collections.emptyList();
//        when(getAdminOrdersQueryHandler.handle(any(GetAdminOrdersQuery.class))).thenReturn(expectedList);
//
//        List<OrderResponse> actualList = queryController.admin(authentication, "PENDING");
//        assertSame(expectedList, actualList);
//    }

//    @Test
//    void adminSystemListShouldDelegateToHandler() {
//        List<OrderResponse> expectedList = Collections.emptyList();
//        when(getAdminOrdersQueryHandler.handle(any(GetAdminOrdersQuery.class))).thenReturn(expectedList);
//
//        List<OrderResponse> actualList = queryController.adminSystemList(authentication, "PENDING");
//        assertSame(expectedList, actualList);
//    }

    @Test
    void detailShouldDelegateToHandler() {
        OrderResponse expectedResponse = orderResponse();
        when(getOrderDetailQueryHandler.handle(any(GetOrderDetailQuery.class))).thenReturn(expectedResponse);

        OrderResponse actualResponse = queryController.detail(authentication, 1L);
        assertSame(expectedResponse, actualResponse);
    }

    @Test
    void itemsShouldDelegateToHandler() {
        List<OrderItemResponse> expectedItems = Collections.emptyList();
        OrderResponse orderResponse = orderResponseWithItems(expectedItems);
        when(getOrderDetailQueryHandler.handle(any(GetOrderDetailQuery.class))).thenReturn(orderResponse);

        List<OrderItemResponse> actualItems = queryController.items(authentication, 1L);
        assertSame(expectedItems, actualItems);
    }

    @Test
    void paymentStatusShouldDelegateToHandler() {
        PaymentStatusResponse expectedResponse = new PaymentStatusResponse(1L, null, null, "PAID", null, null, null);
        when(getOrderPaymentStatusQueryHandler.handle(any(GetOrderPaymentStatusQuery.class))).thenReturn(expectedResponse);

        PaymentStatusResponse actualResponse = queryController.paymentStatus(authentication, 1L);
        assertSame(expectedResponse, actualResponse);
    }

    @Test
    void adminListShouldDelegateToHandler() {
        List<OrderResponse> expectedList = Collections.emptyList();
        when(getAdminOrdersQueryHandler.handle(any(GetAdminOrdersQuery.class))).thenReturn(expectedList);

        List<OrderResponse> actualList = adminOrderQueryController.list(authentication, "PENDING");
        assertSame(expectedList, actualList);
    }

    private OrderResponse orderResponse() {
        return orderResponseWithItems(Collections.emptyList());
    }

    private OrderResponse orderResponseWithItems(List<OrderItemResponse> items) {
        return new OrderResponse(
                1L,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                items,
                Collections.emptyList()
        );
    }
}
