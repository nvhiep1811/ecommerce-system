package com.ecommerce.user.service;

import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.shared.security.JwtService;
import com.ecommerce.shared.web.BusinessException;
import com.ecommerce.user.config.AuthOtpProperties;
import com.ecommerce.user.domain.UserEntity;
import com.ecommerce.user.dto.AuthResponse;
import com.ecommerce.user.dto.LoginRequest;
import com.ecommerce.user.dto.OtpResponse;
import com.ecommerce.user.dto.PasswordResetTokenResponse;
import com.ecommerce.user.dto.RegisterRequest;
import com.ecommerce.user.dto.ResetPasswordRequest;
import com.ecommerce.user.dto.UpdateProfileRequest;
import com.ecommerce.user.dto.UserProfileResponse;
import com.ecommerce.user.dto.VerifyPasswordResetOtpRequest;
import com.ecommerce.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
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
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private OtpService otpService;

    @Mock
    private AuthMailService authMailService;

    @Mock
    private AuthOtpProperties otpProperties;

    @Mock
    private SupabaseStorageService supabaseStorageService;

    @InjectMocks
    private AuthService authService;

    @Test
    void registerNormalizesIdentityAndBuildsTokenForSeller() {
        RegisterRequest request = new RegisterRequest(
                "  SELLER@Example.COM ",
                "secret123",
                "  Nguyen Van Seller  ",
                "   ",
                "seller",
                null
        );
        when(userRepository.existsByEmailIgnoreCase("seller@example.com")).thenReturn(false);
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
    void loginRejectsUnverifiedAccountAfterPasswordIsValid() {
        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("buyer@example.com");
        user.setPasswordHash("stored-hash");
        user.setStatus("active");
        user.setVerified(false);
        user.setRoles(Set.of("CUSTOMER"));
        when(userRepository.findByEmailIgnoreCase("buyer@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "stored-hash")).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> authService.login(new LoginRequest("buyer@example.com", "secret123"))
        );

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatus());
        assertEquals("Email tài khoản chưa được xác thực", exception.getMessage());
        verify(jwtService, never()).generateToken(any(), any(), any(), any());
    }

    @Test
    void loginRejectsInactiveAccountAfterPasswordIsValid() {
        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("buyer@example.com");
        user.setPasswordHash("stored-hash");
        user.setStatus("disabled");
        user.setVerified(true);
        user.setRoles(Set.of("CUSTOMER"));
        when(userRepository.findByEmailIgnoreCase("buyer@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "stored-hash")).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> authService.login(new LoginRequest("buyer@example.com", "secret123"))
        );

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatus());
        assertEquals("Tài khoản chưa được kích hoạt", exception.getMessage());
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

    @Test
    void logoutParsesBearerTokenWhenProvided() {
        String token = "mock.jwt.token";
        authService.logout("Bearer " + token);

        verify(jwtService).parse(token);
    }

    @Test
    void logoutIgnoresInvalidAuthorizationHeader() {
        authService.logout("Basic abc");

        verifyNoInteractions(jwtService);
    }

    @Test
    void registerRequiresOtpWhenEnabled() {
        RegisterRequest request = new RegisterRequest(
                "buyer@example.com",
                "secret123",
                "Nguyen Van A",
                null,
                "customer",
                null
        );
        when(userRepository.existsByEmailIgnoreCase("buyer@example.com")).thenReturn(false);
        when(otpProperties.isEnabled()).thenReturn(true);
        when(otpProperties.isRegisterRequired()).thenReturn(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> authService.register(request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        assertEquals("Registration OTP is required", exception.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    void requestRegistrationOtpSendsEmailWhenEmailIsAvailable() {
        when(userRepository.existsByEmailIgnoreCase("buyer@example.com")).thenReturn(false);
        when(otpService.issueRegistrationOtp("buyer@example.com"))
                .thenReturn(new OtpService.IssuedOtp("123456", true));
        when(otpProperties.getTtlMinutes()).thenReturn(10);
        when(otpService.otpExpiresInSeconds()).thenReturn(600L);

        OtpResponse response = authService.requestRegistrationOtp(" BUYER@example.com ");

        assertEquals(600L, response.expiresInSeconds());
        verify(authMailService).sendRegistrationOtp("buyer@example.com", "123456", 10);
    }

    @Test
    void requestPasswordResetOtpDoesNotRevealUnknownEmail() {
        when(userRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());
        when(otpService.otpExpiresInSeconds()).thenReturn(600L);

        OtpResponse response = authService.requestPasswordResetOtp("missing@example.com");

        assertEquals(600L, response.expiresInSeconds());
        verifyNoInteractions(authMailService);
        verify(otpService, never()).issuePasswordResetOtp(any());
    }

    @Test
    void verifyPasswordResetOtpReturnsResetToken() {
        when(otpService.verifyPasswordResetOtp("buyer@example.com", "123456")).thenReturn("reset-token");
        when(otpService.resetTokenExpiresInSeconds()).thenReturn(600L);

        PasswordResetTokenResponse response = authService.verifyPasswordResetOtp(
                new VerifyPasswordResetOtpRequest("buyer@example.com", "123456")
        );

        assertEquals("reset-token", response.resetToken());
        assertEquals(600L, response.expiresInSeconds());
    }

    @Test
    void resetPasswordConsumesResetTokenAndUpdatesPassword() {
        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("buyer@example.com");
        user.setPasswordHash("old-hash");
        when(userRepository.findByEmailIgnoreCase("buyer@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("new-secret")).thenReturn("new-hash");

        authService.resetPassword(new ResetPasswordRequest("buyer@example.com", "reset-token", "new-secret"));

        verify(otpService).consumePasswordResetToken("buyer@example.com", "reset-token");
        verify(userRepository).save(user);
        assertEquals("new-hash", user.getPasswordHash());
    }

    @Test
    void uploadAvatarStoresNewUrlAndDeletesOldManagedAvatar() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity();
        user.setId(userId);
        user.setEmail("buyer@example.com");
        user.setFullName("Buyer");
        user.setPhoneNumber("0900");
        user.setAvatarUrl("https://project.supabase.co/storage/v1/object/public/product-images/users/avatars/old.jpg");
        user.setStatus("active");
        user.setVerified(true);
        user.setRoles(Set.of("CUSTOMER"));
        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", new byte[]{1, 2, 3});
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(supabaseStorageService.uploadAvatar(userId, file))
                .thenReturn(new SupabaseStorageService.UploadedObject("users/avatars/new.jpg", "https://project.supabase.co/new.jpg"));
        when(userRepository.save(user)).thenReturn(user);

        UserProfileResponse response = authService.uploadAvatar(
                new AuthenticatedUser(userId.toString(), "buyer@example.com", java.util.List.of("CUSTOMER")),
                file
        );

        assertEquals("https://project.supabase.co/new.jpg", response.avatarUrl());
        verify(userRepository).save(user);
        verify(supabaseStorageService).deleteIfManagedAvatarUrl("https://project.supabase.co/storage/v1/object/public/product-images/users/avatars/old.jpg");
    }
}
