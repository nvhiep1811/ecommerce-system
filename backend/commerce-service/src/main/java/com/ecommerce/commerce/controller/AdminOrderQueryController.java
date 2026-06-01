package com.ecommerce.commerce.controller;
 
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.query.GetAdminOrdersQuery;
import com.ecommerce.commerce.query.GetAdminOrdersQueryHandler;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
 
import java.util.List;
 
@RestController
@RequestMapping({"/commerce/admin/orders", "/admin/orders"})
public class AdminOrderQueryController {
 
    private final GetAdminOrdersQueryHandler getAdminOrdersQueryHandler;
 
    public AdminOrderQueryController(GetAdminOrdersQueryHandler getAdminOrdersQueryHandler) {
        this.getAdminOrdersQueryHandler = getAdminOrdersQueryHandler;
    }
 
    @GetMapping
    public List<OrderResponse> list(Authentication authentication, @RequestParam(name = "status", required = false) String status) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return getAdminOrdersQueryHandler.handle(new GetAdminOrdersQuery(principal, status));
    }
}
