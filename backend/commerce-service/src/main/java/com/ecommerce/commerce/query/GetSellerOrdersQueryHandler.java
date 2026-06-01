package com.ecommerce.commerce.query;
 
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.service.OrderQueryService;
import org.springframework.stereotype.Component;
 
import java.util.List;
 
@Component
public class GetSellerOrdersQueryHandler {
 
    private final OrderQueryService orderQueryService;
 
    public GetSellerOrdersQueryHandler(OrderQueryService orderQueryService) {
        this.orderQueryService = orderQueryService;
    }
 
    public List<OrderResponse> handle(GetSellerOrdersQuery query) {
        return orderQueryService.listSeller(query.principal(), query.status());
    }
}
