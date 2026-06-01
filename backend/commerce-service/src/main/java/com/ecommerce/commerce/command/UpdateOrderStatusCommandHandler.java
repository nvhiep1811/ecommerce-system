package com.ecommerce.commerce.command;
 
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.service.OrderManagementService;
import org.springframework.stereotype.Component;
 
@Component
public class UpdateOrderStatusCommandHandler {
 
    private final OrderManagementService orderManagementService;
 
    public UpdateOrderStatusCommandHandler(OrderManagementService orderManagementService) {
        this.orderManagementService = orderManagementService;
    }
 
    public OrderResponse handle(UpdateOrderStatusCommand command) {
        return orderManagementService.updateStatus(command.principal(), command.orderId(), command.status());
    }
}
