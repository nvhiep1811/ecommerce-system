package com.ecommerce.user.service;

import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.security.JwtService;
import com.ecommerce.shared.web.BusinessException;
import com.ecommerce.user.domain.UserEntity;
import com.ecommerce.user.dto.AuthResponse;
import com.ecommerce.user.dto.LoginRequest;
import com.ecommerce.user.dto.RegisterRequest;
import com.ecommerce.user.dto.UpdateProfileRequest;
import com.ecommerce.user.dto.UserProfileResponse;
import com.ecommerce.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    @Test
    void registerNormalizesIdentityAndBuildsTokenForSeller() {
        RegisterRequest request = new RegisterRequest(
                "  SELLER@Example.COM ",
                "secret123",
                "  Nguyen Van Seller  ",
                "   ",
                "seller"
        );
        when(userRepository.existsByEmailIgnoreCase("  SELLER@Example.COM ")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("encoded-password");
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity user = invocation.getArgument(0);
            user.setCreatedAt(OffsetDateTime.now());
            user.setUpdatedAt(OffsetDateTime.now());
            return user;
        });
        when(jwtService.generateToken(any(), any(), any(), any())).thenReturn("jwt-token");

        AuthResponse response = authService.register(request);

        assertEquals("jwt-token", response.accessToken());
        assertEquals("seller", response.user().role());
        assertEquals("seller@example.com", response.user().email());
        assertEquals("Nguyen Van Seller", response.user().fullName());
        assertNull(response.user().phoneNumber());

        ArgumentCaptor<UserEntity> userCaptor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(userCaptor.capture());
        UserEntity savedUser = userCaptor.getValue();
        assertEquals("seller@example.com", savedUser.getEmail());
        assertEquals("encoded-password", savedUser.getPasswordHash());
        assertEquals("Nguyen Van Seller", savedUser.getFullName());
        assertNull(savedUser.getPhoneNumber());
        assertEquals(Set.of("SELLER"), savedUser.getRoles());
        assertEquals("active", savedUser.getStatus());
        assertTrue(savedUser.getId() != null);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> claimsCaptor = (ArgumentCaptor<Map<String, Object>>) (ArgumentCaptor<?>) ArgumentCaptor.forClass(Map.class);
        verify(jwtService).generateToken(
                eq(savedUser.getId().toString()),
                eq("seller@example.com"),
                eq(java.util.List.of("SELLER")),
                claimsCaptor.capture()
        );
        Map<String, Object> claims = claimsCaptor.getValue();
        assertEquals("Nguyen Van Seller", claims.get("fullName"));
    }

    @Test
    void loginRejectsInvalidPassword() {
        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("buyer@example.com");
        user.setPasswordHash("stored-hash");
        user.setRoles(Set.of("CUSTOMER"));
        when(userRepository.findByEmailIgnoreCase("buyer@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "stored-hash")).thenReturn(false);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> authService.login(new LoginRequest("buyer@example.com", "wrong-password"))
        );

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatus());
        assertEquals("Invalid email or password", exception.getMessage());
        verify(jwtService, never()).generateToken(any(), any(), any(), any());
    }

    @Test
    void updateProfileTrimsValuesAndConvertsBlankOptionalFieldsToNull() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setEmail("buyer@example.com");
        user.setFullName("Old Name");
        user.setPhoneNumber("0900");
        user.setAvatarUrl("avatar-old");
        user.setRoles(Set.of("CUSTOMER"));
        user.setCreatedAt(OffsetDateTime.now().minusDays(1));
        user.setUpdatedAt(OffsetDateTime.now().minusHours(1));

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserProfileResponse response = authService.updateProfile(
                new AuthenticatedUser(userId.toString(), "buyer@example.com", java.util.List.of("CUSTOMER")),
                new UpdateProfileRequest("  New Name  ", "   ", "")
        );

        assertEquals("New Name", response.fullName());
        assertNull(response.phoneNumber());
        assertNull(response.avatarUrl());

        verify(userRepository).save(user);
        assertEquals("New Name", user.getFullName());
        assertNull(user.getPhoneNumber());
        assertNull(user.getAvatarUrl());
    }

    @Test
    void currentUserMapsAdminRoleForMobileClients() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setEmail("admin@example.com");
        user.setFullName("System Admin");
        user.setRoles(Set.of("ADMIN"));
        user.setCreatedAt(OffsetDateTime.now().minusDays(10));
        user.setUpdatedAt(OffsetDateTime.now().minusDays(1));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        UserProfileResponse response = authService.currentUser(
                new AuthenticatedUser(userId.toString(), "admin@example.com", java.util.List.of("ADMIN"))
        );

        assertSame(userId, response.id());
        assertEquals("admin", response.role());
        assertEquals("System Admin", response.fullName());
    }
}
