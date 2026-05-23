//package com.ecommerce.chat.service;
//
//import io.jsonwebtoken.*;
//import io.jsonwebtoken.security.Keys;
//import lombok.extern.slf4j.Slf4j;
//import org.springframework.beans.factory.annotation.Value;
//import org.springframework.stereotype.Service;
//
//import javax.crypto.SecretKey;
//import java.nio.charset.StandardCharsets;
//import java.util.UUID;
//
///**
// * JWT helper - validate token va extract claims.
// *
// * JWT phai chua cac claims:
// *   - "userId" : String (UUID) -> ID nguoi dung, khop voi UserEntity.id
// *   - "role"   : String        -> "CUSTOMER" | "SELLER" | "ADMIN"
// */
//@Slf4j
//@Service
//public class JwtService {
//
//    @Value("${app.jwt.secret}")
//    private String secret;
//
//    private SecretKey getKey() {
//        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
//    }
//
//    public boolean validateToken(String token) {
//        try {
//            Jwts.parser().verifyWith(getKey()).build().parseSignedClaims(token);
//            return true;
//        } catch (JwtException | IllegalArgumentException e) {
//            log.debug("JWT validation failed: {}", e.getMessage());
//            return false;
//        }
//    }
//
//    public Claims extractClaims(String token) {
//        return Jwts.parser()
//                .verifyWith(getKey())
//                .build()
//                .parseSignedClaims(token)
//                .getPayload();
//    }
//
//    /**
//     * Extract userId as UUID - khop voi UserEntity.id kieu UUID.
//     * JWT claim "userId" phai la string dang UUID: "550e8400-e29b-41d4-a716-446655440000"
//     */
//    public UUID extractUserId(String token) {
//        String userId = extractClaims(token).get("userId", String.class);
//        if (userId == null) {
//            throw new IllegalStateException("JWT missing claim 'userId'");
//        }
//        try {
//            return UUID.fromString(userId);
//        } catch (IllegalArgumentException e) {
//            throw new IllegalStateException("JWT claim 'userId' is not a valid UUID: " + userId);
//        }
//    }
//
//    public String extractRole(String token) {
//        String role = extractClaims(token).get("role", String.class);
//        return role != null ? role : "CUSTOMER";
//    }
//}