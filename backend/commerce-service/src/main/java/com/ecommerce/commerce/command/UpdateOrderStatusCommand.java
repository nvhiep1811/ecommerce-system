package com.ecommerce.commerce.command;
 
import com.ecommerce.shared.security.AuthenticatedUser;
 
public record UpdateOrderStatusCommand(
        AuthenticatedUser principal,
        Long orderId,
        String status
) {
}
