package com.ecommerce.shared.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JwtServiceTest {

    private static final String TEST_SECRET = "01234567890123456789012345678901";

    @Test
    void generateTokenPreservesExpectedClaims() {
        JwtService jwtService = new JwtService(TEST_SECRET, 3600);
        jwtService.init();

        String token = jwtService.generateToken(
                "user-1",
                "seller@example.com",
                List.of("seller"),
                Map.of("tenant", "demo")
        );

        var claims = jwtService.parse(token);

        assertEquals("user-1", claims.getSubject());
        assertEquals("seller@example.com", claims.get("email", String.class));
        assertEquals("demo", claims.get("tenant", String.class));
        assertIterableEquals(List.of("seller"), claims.get("roles", List.class));
    }

    @Test
    void toAuthenticationAddsRolePrefixWhenNeeded() {
        JwtService jwtService = new JwtService(TEST_SECRET, 3600);
        jwtService.init();

        String token = jwtService.generateToken(
                "user-2",
                "admin@example.com",
                List.of("seller", "ROLE_admin"),
                Map.of()
        );

        Authentication authentication = jwtService.toAuthentication(token);

        assertInstanceOf(AuthenticatedUser.class, authentication.getPrincipal());
        AuthenticatedUser principal = (AuthenticatedUser) authentication.getPrincipal();

        assertEquals("user-2", principal.userId());
        assertEquals("admin@example.com", principal.email());
        assertIterableEquals(List.of("seller", "ROLE_admin"), principal.roles());

        List<String> authorities = authentication.getAuthorities()
                .stream()
                .map(GrantedAuthority::getAuthority)
                .toList();

        assertTrue(authorities.contains("ROLE_seller"));
        assertTrue(authorities.contains("ROLE_admin"));
    }
}
