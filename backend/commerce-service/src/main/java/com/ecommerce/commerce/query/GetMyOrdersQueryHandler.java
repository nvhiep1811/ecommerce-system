package com.ecommerce.commerce.query;
 
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.service.OrderQueryService;
import org.springframework.stereotype.Component;
 
import java.util.List;
 
@Component
public class GetMyOrdersQueryHandler {
 
    private final OrderQueryService orderQueryService;
 
    public GetMyOrdersQueryHandler(OrderQueryService orderQueryService) {
        this.orderQueryService = orderQueryService;
    }
 
    public List<OrderResponse> handle(GetMyOrdersQuery query) {
        return orderQueryService.listMine(query.principal(), query.status());
    }
}
