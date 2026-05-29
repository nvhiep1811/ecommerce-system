package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.service.OrderQueryService;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping({"/commerce/admin/orders", "/admin/orders"})
public class AdminOrderController {

    private final OrderQueryService orderQueryService;

    public AdminOrderController(OrderQueryService orderQueryService) {
        this.orderQueryService = orderQueryService;
    }

    @GetMapping
    public List<OrderResponse> list(Authentication authentication, @RequestParam(name = "status", required = false) String status) {
        return orderQueryService.listAdmin((AuthenticatedUser) authentication.getPrincipal(), status);
    }
}
