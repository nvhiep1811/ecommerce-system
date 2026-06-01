package com.ecommerce.commerce.query;
 
import com.ecommerce.shared.security.AuthenticatedUser;
 
public record GetAdminOrdersQuery(
        AuthenticatedUser principal,
        String status
) {
}
