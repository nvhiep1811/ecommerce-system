//package com.ecommerce.commerce.controller;
//
//import com.ecommerce.commerce.dto.OrderItemResponse;
//import com.ecommerce.commerce.dto.OrderResponse;
//import com.ecommerce.commerce.dto.PaymentStatusResponse;
//import com.ecommerce.commerce.query.GetAdminOrdersQuery;
//import com.ecommerce.commerce.query.GetAdminOrdersQueryHandler;
//import com.ecommerce.commerce.query.GetMyOrdersQuery;
//import com.ecommerce.commerce.query.GetMyOrdersQueryHandler;
//import com.ecommerce.commerce.query.GetOrderDetailQuery;
//import com.ecommerce.commerce.query.GetOrderDetailQueryHandler;
//import com.ecommerce.commerce.query.GetOrderPaymentStatusQuery;
//import com.ecommerce.commerce.query.GetOrderPaymentStatusQueryHandler;
//import com.ecommerce.commerce.query.GetSellerOrdersQuery;
//import com.ecommerce.commerce.query.GetSellerOrdersQueryHandler;
//import com.ecommerce.shared.security.AuthenticatedUser;
//import org.springframework.security.core.Authentication;
//import org.springframework.web.bind.annotation.GetMapping;
//import org.springframework.web.bind.annotation.PathVariable;
//import org.springframework.web.bind.annotation.RequestMapping;
//import org.springframework.web.bind.annotation.RequestParam;
//import org.springframework.web.bind.annotation.RestController;
//
//import java.util.List;
//
//@RestController
//@RequestMapping({"/commerce/orders", "/orders"})
//public class OrderQueryController {
//
//    private final GetMyOrdersQueryHandler getMyOrdersQueryHandler;
//    private final GetSellerOrdersQueryHandler getSellerOrdersQueryHandler;
////    private final GetAdminOrdersQueryHandler getAdminOrdersQueryHandler;
//    private final GetOrderDetailQueryHandler getOrderDetailQueryHandler;
//    private final GetOrderPaymentStatusQueryHandler getOrderPaymentStatusQueryHandler;
//
//    public OrderQueryController(
//            GetMyOrdersQueryHandler getMyOrdersQueryHandler,
//            GetSellerOrdersQueryHandler getSellerOrdersQueryHandler,
//            GetOrderDetailQueryHandler getOrderDetailQueryHandler,
//            GetOrderPaymentStatusQueryHandler getOrderPaymentStatusQueryHandler
//    ) {
//        this.getMyOrdersQueryHandler = getMyOrdersQueryHandler;
//        this.getSellerOrdersQueryHandler = getSellerOrdersQueryHandler;
////        this.getAdminOrdersQueryHandler = getAdminOrdersQueryHandler;
//        this.getOrderDetailQueryHandler = getOrderDetailQueryHandler;
//        this.getOrderPaymentStatusQueryHandler = getOrderPaymentStatusQueryHandler;
//    }
//
//    @GetMapping("/mine")
//    public List<OrderResponse> mine(Authentication authentication, @RequestParam(name = "status", required = false) String status) {
//        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
//        return getMyOrdersQueryHandler.handle(new GetMyOrdersQuery(principal, status));
//    }
//
//    @GetMapping("/seller")
//    public List<OrderResponse> seller(Authentication authentication, @RequestParam(name = "status", required = false) String status) {
//        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
//        return getSellerOrdersQueryHandler.handle(new GetSellerOrdersQuery(principal, status));
//    }
//
////    @GetMapping("/admin")
////    public List<OrderResponse> admin(Authentication authentication, @RequestParam(name = "status", required = false) String status) {
////        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
////        return getAdminOrdersQueryHandler.handle(new GetAdminOrdersQuery(principal, status));
////    }
////
////    @GetMapping("/system/list")
////    public List<OrderResponse> adminSystemList(Authentication authentication, @RequestParam(name = "status", required = false) String status) {
////        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
////        return getAdminOrdersQueryHandler.handle(new GetAdminOrdersQuery(principal, status));
////    }
//
//    @GetMapping("/{id}")
//    public OrderResponse detail(Authentication authentication, @PathVariable("id") Long id) {
//        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
//        return getOrderDetailQueryHandler.handle(new GetOrderDetailQuery(principal, id));
//    }
//
//    @GetMapping("/{id}/items")
//    public List<OrderItemResponse> items(Authentication authentication, @PathVariable("id") Long id) {
//        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
//        return getOrderDetailQueryHandler.handle(new GetOrderDetailQuery(principal, id)).items();
//    }
//
//    @GetMapping("/{id}/payment-status")
//    public PaymentStatusResponse paymentStatus(Authentication authentication, @PathVariable("id") Long id) {
//        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
//        return getOrderPaymentStatusQueryHandler.handle(new GetOrderPaymentStatusQuery(principal, id));
//    }
//}

package com.ecommerce.commerce.controller;

import com.ecommerce.commerce.dto.OrderItemResponse;
import com.ecommerce.commerce.dto.OrderResponse;
import com.ecommerce.commerce.dto.PaymentStatusResponse;
import com.ecommerce.commerce.query.GetMyOrdersQuery;
import com.ecommerce.commerce.query.GetMyOrdersQueryHandler;
import com.ecommerce.commerce.query.GetOrderDetailQuery;
import com.ecommerce.commerce.query.GetOrderDetailQueryHandler;
import com.ecommerce.commerce.query.GetOrderPaymentStatusQuery;
import com.ecommerce.commerce.query.GetOrderPaymentStatusQueryHandler;
import com.ecommerce.commerce.query.GetSellerOrdersQuery;
import com.ecommerce.commerce.query.GetSellerOrdersQueryHandler;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping({"/commerce/orders", "/orders"})
public class OrderQueryController {

    private final GetMyOrdersQueryHandler getMyOrdersQueryHandler;
    private final GetSellerOrdersQueryHandler getSellerOrdersQueryHandler;
    private final GetOrderDetailQueryHandler getOrderDetailQueryHandler;
    private final GetOrderPaymentStatusQueryHandler getOrderPaymentStatusQueryHandler;

    public OrderQueryController(
            GetMyOrdersQueryHandler getMyOrdersQueryHandler,
            GetSellerOrdersQueryHandler getSellerOrdersQueryHandler,
            GetOrderDetailQueryHandler getOrderDetailQueryHandler,
            GetOrderPaymentStatusQueryHandler getOrderPaymentStatusQueryHandler
    ) {
        this.getMyOrdersQueryHandler = getMyOrdersQueryHandler;
        this.getSellerOrdersQueryHandler = getSellerOrdersQueryHandler;
        this.getOrderDetailQueryHandler = getOrderDetailQueryHandler;
        this.getOrderPaymentStatusQueryHandler = getOrderPaymentStatusQueryHandler;
    }

    @GetMapping("/mine")
    public List<OrderResponse> mine(Authentication authentication, @RequestParam(name = "status", required = false) String status) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return getMyOrdersQueryHandler.handle(new GetMyOrdersQuery(principal, status));
    }

    @GetMapping("/seller")
    public List<OrderResponse> seller(Authentication authentication, @RequestParam(name = "status", required = false) String status) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return getSellerOrdersQueryHandler.handle(new GetSellerOrdersQuery(principal, status));
    }

    @GetMapping("/{id}")
    public OrderResponse detail(Authentication authentication, @PathVariable("id") Long id) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return getOrderDetailQueryHandler.handle(new GetOrderDetailQuery(principal, id));
    }

    @GetMapping("/{id}/items")
    public List<OrderItemResponse> items(Authentication authentication, @PathVariable("id") Long id) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return getOrderDetailQueryHandler.handle(new GetOrderDetailQuery(principal, id)).items();
    }

    @GetMapping("/{id}/payment-status")
    public PaymentStatusResponse paymentStatus(Authentication authentication, @PathVariable("id") Long id) {
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();
        return getOrderPaymentStatusQueryHandler.handle(new GetOrderPaymentStatusQuery(principal, id));
    }
}