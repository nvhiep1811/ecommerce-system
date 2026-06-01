package com.ecommerce.commerce.query;
 
import com.ecommerce.shared.security.AuthenticatedUser;
 
public record GetOrderPaymentStatusQuery(
        AuthenticatedUser principal,
        Long orderId
) {
}
