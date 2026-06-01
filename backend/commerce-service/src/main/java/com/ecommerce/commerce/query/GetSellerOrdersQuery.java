package com.ecommerce.commerce.query;
 
import com.ecommerce.shared.security.AuthenticatedUser;
 
public record GetSellerOrdersQuery(
        AuthenticatedUser principal,
        String status
) {
}
