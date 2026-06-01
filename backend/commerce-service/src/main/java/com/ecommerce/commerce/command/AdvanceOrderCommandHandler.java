package com.ecommerce.commerce.command;
 
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.service.OrderManagementService;
import org.springframework.stereotype.Component;
 
@Component
public class AdvanceOrderCommandHandler {
 
    private final OrderManagementService orderManagementService;
 
    public AdvanceOrderCommandHandler(OrderManagementService orderManagementService) {
        this.orderManagementService = orderManagementService;
    }
 
    public OrderResponse handle(AdvanceOrderCommand command) {
        return orderManagementService.advance(command.principal(), command.orderId());
    }
}
