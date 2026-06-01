package com.ecommerce.commerce.query;
 
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.service.OrderQueryService;
import org.springframework.stereotype.Component;
 
import java.util.List;
 
@Component
public class GetAdminOrdersQueryHandler {
 
    private final OrderQueryService orderQueryService;
 
    public GetAdminOrdersQueryHandler(OrderQueryService orderQueryService) {
        this.orderQueryService = orderQueryService;
    }
 
    public List<OrderResponse> handle(GetAdminOrdersQuery query) {
        return orderQueryService.listAdmin(query.principal(), query.status());
    }
}
