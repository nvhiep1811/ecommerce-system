package com.ecommerce.commerce.command;
 
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.service.OrderManagementService;
import org.springframework.stereotype.Component;
 
@Component
public class CancelOrderCommandHandler {
 
    private final OrderManagementService orderManagementService;
 
    public CancelOrderCommandHandler(OrderManagementService orderManagementService) {
        this.orderManagementService = orderManagementService;
    }
 
    public OrderResponse handle(CancelOrderCommand command) {
        return orderManagementService.cancel(command.principal(), command.orderId());
    }
}
