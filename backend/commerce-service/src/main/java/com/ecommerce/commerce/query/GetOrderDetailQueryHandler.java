package com.ecommerce.commerce.query;
 
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.service.OrderQueryService;
import org.springframework.stereotype.Component;
 
@Component
public class GetOrderDetailQueryHandler {
 
    private final OrderQueryService orderQueryService;
 
    public GetOrderDetailQueryHandler(OrderQueryService orderQueryService) {
        this.orderQueryService = orderQueryService;
    }
 
    public OrderResponse handle(GetOrderDetailQuery query) {
        return orderQueryService.getForUser(query.principal(), query.orderId());
    }
}
