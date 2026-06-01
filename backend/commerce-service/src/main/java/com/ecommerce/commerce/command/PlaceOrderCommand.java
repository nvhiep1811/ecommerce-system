package com.ecommerce.commerce.command;
 
import com.ecommerce.commerce.dto.PlaceOrderRequest;
import com.ecommerce.shared.security.AuthenticatedUser;
 
public record PlaceOrderCommand(
        AuthenticatedUser principal,
        PlaceOrderRequest request
) {
}
