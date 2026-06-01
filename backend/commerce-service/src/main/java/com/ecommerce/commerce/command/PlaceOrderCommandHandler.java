package com.ecommerce.commerce.command;
 
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.service.CheckoutOrchestrator;
import org.springframework.stereotype.Component;
 
@Component
public class PlaceOrderCommandHandler {
 
    private final CheckoutOrchestrator checkoutOrchestrator;
 
    public PlaceOrderCommandHandler(CheckoutOrchestrator checkoutOrchestrator) {
        this.checkoutOrchestrator = checkoutOrchestrator;
    }
 
    public OrderResponse handle(PlaceOrderCommand command) {
        return checkoutOrchestrator.placeOrder(command.principal(), command.request());
    }
}
