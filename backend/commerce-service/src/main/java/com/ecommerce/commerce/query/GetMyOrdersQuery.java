package com.ecommerce.commerce.query;
 
import com.ecommerce.shared.security.AuthenticatedUser;
 
public record GetMyOrdersQuery(
        AuthenticatedUser principal,
        String status
) {
}
