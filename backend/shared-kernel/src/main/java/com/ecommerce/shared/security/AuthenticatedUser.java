package com.ecommerce.shared.security;

import java.util.List;

public record AuthenticatedUser(
        String userId,
        String email,
        List<String> roles
) {
}
