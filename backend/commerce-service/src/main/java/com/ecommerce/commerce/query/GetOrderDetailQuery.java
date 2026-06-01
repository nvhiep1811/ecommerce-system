package com.ecommerce.commerce.query;
 
import com.ecommerce.shared.security.AuthenticatedUser;
 
public record GetOrderDetailQuery(
        AuthenticatedUser principal,
        Long orderId
) {
}
