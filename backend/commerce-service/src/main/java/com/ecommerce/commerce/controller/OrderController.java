package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.OrderItemResponse;
import com.ecommerce.commerce.dto.OrderQuoteRequest;
import com.ecommerce.commerce.dto.OrderQuoteResponse;
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.dto.OrderStatusUpdateRequest;
import com.ecommerce.commerce.dto.PaymentStatusResponse;
import com.ecommerce.commerce.dto.PlaceOrderRequest;
import com.ecommerce.commerce.service.CheckoutOrchestrator;
import com.ecommerce.commerce.service.OrderManagementService;
import com.ecommerce.commerce.service.OrderQueryService;
import com.ecommerce.commerce.service.PaymentService;
import com.ecommerce.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping({"/commerce/orders", "/orders"})
public class OrderController {

    private final CheckoutOrchestrator checkoutOrchestrator;
    private final OrderQueryService orderQueryService;
    private final OrderManagementService orderManagementService;
    private final PaymentService paymentService;

    public OrderController(
            CheckoutOrchestrator checkoutOrchestrator,
            OrderQueryService orderQueryService,
            OrderManagementService orderManagementService,
            PaymentService paymentService
    ) {
        this.checkoutOrchestrator = checkoutOrchestrator;
        this.orderQueryService = orderQueryService;
        this.orderManagementService = orderManagementService;
        this.paymentService = paymentService;
    }

    @PostMapping("/quote")
    public OrderQuoteResponse quote(@Valid @RequestBody OrderQuoteRequest request) {
        return checkoutOrchestrator.quote(request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse placeOrder(Authentication authentication, @Valid @RequestBody PlaceOrderRequest request) {
        return checkoutOrchestrator.placeOrder((AuthenticatedUser) authentication.getPrincipal(), request);
    }

    @GetMapping("/mine")
    public List<OrderResponse> mine(Authentication authentication, @RequestParam(name = "status", required = false) String status) {
        return orderQueryService.listMine((AuthenticatedUser) authentication.getPrincipal(), status);
    }

    @GetMapping("/seller")
    public List<OrderResponse> seller(Authentication authentication, @RequestParam(name = "status", required = false) String status) {
        return orderQueryService.listSeller((AuthenticatedUser) authentication.getPrincipal(), status);
    }

    @GetMapping("/{id}")
    public OrderResponse detail(Authentication authentication, @PathVariable("id") Long id) {
        return orderQueryService.getForUser((AuthenticatedUser) authentication.getPrincipal(), id);
    }

    @GetMapping("/{id}/items")
    public List<OrderItemResponse> items(Authentication authentication, @PathVariable("id") Long id) {
        return orderQueryService.getForUser((AuthenticatedUser) authentication.getPrincipal(), id).items();
    }

    @GetMapping("/{id}/payment-status")
    public PaymentStatusResponse paymentStatus(Authentication authentication, @PathVariable("id") Long id) {
        return paymentService.getPaymentStatus((AuthenticatedUser) authentication.getPrincipal(), id);
    }

    @PatchMapping("/{id}/status")
    public OrderResponse updateStatus(Authentication authentication, @PathVariable("id") Long id, @Valid @RequestBody OrderStatusUpdateRequest request) {
        return orderManagementService.updateStatus((AuthenticatedUser) authentication.getPrincipal(), id, request.status());
    }
}
