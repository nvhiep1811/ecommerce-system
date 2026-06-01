package com.ecommerce.commerce.controller;
 
import com.ecommerce.commerce.command.AdvanceOrderCommand;
import com.ecommerce.commerce.command.AdvanceOrderCommandHandler;
import com.ecommerce.commerce.command.CancelOrderCommand;
import com.ecommerce.commerce.command.CancelOrderCommandHandler;
import com.ecommerce.commerce.command.PlaceOrderCommand;
import com.ecommerce.commerce.command.PlaceOrderCommandHandler;
import com.ecommerce.commerce.command.QuoteOrderCommand;
import com.ecommerce.commerce.command.QuoteOrderCommandHandler;
import com.ecommerce.commerce.command.UpdateOrderStatusCommand;
import com.ecommerce.commerce.command.UpdateOrderStatusCommandHandler;
import com.ecommerce.commerce.dto.OrderQuoteRequest;
import com.ecommerce.commerce.dto.OrderQuoteResponse;
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.dto.OrderStatusUpdateRequest;
import com.ecommerce.commerce.dto.PlaceOrderRequest;
import com.ecommerce.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
 
@RestController
@RequestMapping({"/commerce/orders", "/orders"})
public class OrderCommandController {
 
    private final QuoteOrderCommandHandler quoteOrderCommandHandler;
    private final PlaceOrderCommandHandler placeOrderCommandHandler;
    private final UpdateOrderStatusCommandHandler updateOrderStatusCommandHandler;
    private final AdvanceOrderCommandHandler advanceOrderCommandHandler;
    private final CancelOrderCommandHandler cancelOrderCommandHandler;
 
    public OrderCommandController(
            QuoteOrderCommandHandler quoteOrderCommandHandler,
            PlaceOrderCommandHandler placeOrderCommandHandler,
            UpdateOrderStatusCommandHandler updateOrderStatusCommandHandler,
            AdvanceOrderCommandHandler advanceOrderCommandHandler,
            CancelOrderCommandHandler cancelOrderCommandHandler
    ) {
        this.quoteOrderCommandHandler = quoteOrderCommandHandler;
        this.placeOrderCommandHandler = placeOrderCommandHandler;
        this.updateOrderStatusCommandHandler = updateOrderStatusCommandHandler;
        this.advanceOrderCommandHandler = advanceOrderCommandHandler;
        this.cancelOrderCommandHandler = cancelOrderCommandHandler;
    }
 
    @PostMapping("/quote")
    public OrderQuoteResponse quote(Authentication authentication, @Valid @RequestBody OrderQuoteRequest request) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return quoteOrderCommandHandler.handle(new QuoteOrderCommand(principal, request));
    }
 
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse placeOrder(Authentication authentication, @Valid @RequestBody PlaceOrderRequest request) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return placeOrderCommandHandler.handle(new PlaceOrderCommand(principal, request));
    }
 
    @PatchMapping("/{id}/status")
    public OrderResponse updateStatus(Authentication authentication, @PathVariable("id") Long id, @Valid @RequestBody OrderStatusUpdateRequest request) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return updateOrderStatusCommandHandler.handle(new UpdateOrderStatusCommand(principal, id, request.status()));
    }
 
    @PostMapping("/{id}/next")
    public OrderResponse advance(Authentication authentication, @PathVariable("id") Long id) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return advanceOrderCommandHandler.handle(new AdvanceOrderCommand(principal, id));
    }
 
    @PostMapping("/{id}/cancel")
    public OrderResponse cancel(Authentication authentication, @PathVariable("id") Long id) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return cancelOrderCommandHandler.handle(new CancelOrderCommand(principal, id));
    }
}
