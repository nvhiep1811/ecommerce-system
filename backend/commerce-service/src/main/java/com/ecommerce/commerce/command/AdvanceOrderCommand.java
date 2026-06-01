package com.ecommerce.commerce.command;
 
import com.ecommerce.shared.security.AuthenticatedUser;
 
public record AdvanceOrderCommand(
        AuthenticatedUser principal,
        Long orderId
) {
}
