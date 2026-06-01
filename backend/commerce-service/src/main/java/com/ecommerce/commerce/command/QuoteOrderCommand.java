package com.ecommerce.commerce.command;
 
import com.ecommerce.commerce.dto.OrderQuoteRequest;
import com.ecommerce.shared.security.AuthenticatedUser;
 
public record QuoteOrderCommand(
        AuthenticatedUser principal,
        OrderQuoteRequest request
) {
}
