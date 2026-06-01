package com.ecommerce.commerce.command;
 
import com.ecommerce.commerce.dto.OrderQuoteResponse;
import com.ecommerce.commerce.service.CheckoutOrchestrator;
import org.springframework.stereotype.Component;
 
@Component
public class QuoteOrderCommandHandler {
 
    private final CheckoutOrchestrator checkoutOrchestrator;
 
    public QuoteOrderCommandHandler(CheckoutOrchestrator checkoutOrchestrator) {
        this.checkoutOrchestrator = checkoutOrchestrator;
    }
 
    public OrderQuoteResponse handle(QuoteOrderCommand command) {
        return checkoutOrchestrator.quote(command.principal(), command.request());
    }
}
