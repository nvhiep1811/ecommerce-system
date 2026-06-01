package com.ecommerce.commerce.command;
 
import com.ecommerce.shared.security.AuthenticatedUser;
 
public record CancelOrderCommand(
        AuthenticatedUser principal,
        Long orderId
) {
}
