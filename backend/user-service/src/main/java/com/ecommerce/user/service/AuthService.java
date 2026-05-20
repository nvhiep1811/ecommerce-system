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
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OtpService otpService;
    private final AuthMailService authMailService;
    private final AuthOtpProperties otpProperties;
    private final SupabaseStorageService supabaseStorageService;
    private final long rememberMeExpirationSeconds;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            OtpService otpService,
            AuthMailService authMailService,
            AuthOtpProperties otpProperties,
            SupabaseStorageService supabaseStorageService,
            @org.springframework.beans.factory.annotation.Value("${security.jwt.remember-me-expiration-seconds:2592000}") long rememberMeExpirationSeconds
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.otpService = otpService;
        this.authMailService = authMailService;
        this.otpProperties = otpProperties;
        this.supabaseStorageService = supabaseStorageService;
        this.rememberMeExpirationSeconds = rememberMeExpirationSeconds;
    }

    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new BusinessException(HttpStatus.CONFLICT, "Email already exists");
        }
        if (otpProperties.isEnabled() && otpProperties.isRegisterRequired()) {
            if (request.otp() == null || request.otp().isBlank()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "Registration OTP is required");
            }
            otpService.verifyRegistrationOtp(email, request.otp());
        }

        UserEntity entity = new UserEntity();
        entity.setId(UUID.randomUUID());
        entity.setEmail(email);
        entity.setPasswordHash(passwordEncoder.encode(request.password()));
        entity.setFullName(request.fullName().trim());
        entity.setPhoneNumber(blankToNull(request.phoneNumber()));
        entity.setAvatarUrl(null);
        entity.setStatus("active");
        entity.setVerified(true);
        entity.setRoles(Set.of(resolveRole(request.role())));

        UserEntity saved = userRepository.save(entity);
        return buildAuthResponse(saved, jwtService.getExpirationSeconds());
    }

    public OtpResponse requestRegistrationOtp(String email) {
        String normalizedEmail = normalizeEmail(email);
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new BusinessException(HttpStatus.CONFLICT, "Email already exists");
        }
        OtpService.IssuedOtp issuedOtp = otpService.issueRegistrationOtp(normalizedEmail);
        if (issuedOtp.shouldSendEmail()) {
            authMailService.sendRegistrationOtp(normalizedEmail, issuedOtp.otp(), otpProperties.getTtlMinutes());
        }
        return new OtpResponse("Nếu email hợp lệ, mã OTP sẽ được gửi trong ít phút.", otpService.otpExpiresInSeconds());
    }

    public AuthResponse login(LoginRequest request) {
        UserEntity user = userRepository.findByEmail(normalizeEmail(request.email()))
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        ensureLoginAllowed(user);

        long expirationSeconds = request.isRememberMe()
                ? rememberMeExpirationSeconds
                : jwtService.getExpirationSeconds();
        return buildAuthResponse(user, expirationSeconds);
    }

    public OtpResponse requestPasswordResetOtp(String email) {
        String normalizedEmail = normalizeEmail(email);
        userRepository.findByEmail(normalizedEmail).ifPresent(user -> {
            OtpService.IssuedOtp issuedOtp = otpService.issuePasswordResetOtp(normalizedEmail);
            if (issuedOtp.shouldSendEmail()) {
                authMailService.sendPasswordResetOtp(normalizedEmail, issuedOtp.otp(), otpProperties.getTtlMinutes());
            }
        });
        return new OtpResponse("Nếu email tồn tại, mã OTP đặt lại mật khẩu sẽ được gửi trong ít phút.", otpService.otpExpiresInSeconds());
    }

    public PasswordResetTokenResponse verifyPasswordResetOtp(VerifyPasswordResetOtpRequest request) {
        String resetToken = otpService.verifyPasswordResetOtp(normalizeEmail(request.email()), request.otp());
        return new PasswordResetTokenResponse(resetToken, otpService.resetTokenExpiresInSeconds());
    }

    public void resetPassword(ResetPasswordRequest request) {
        String email = normalizeEmail(request.email());
        otpService.consumePasswordResetToken(email, request.resetToken());
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(HttpStatus.BAD_REQUEST, "Invalid or expired reset token"));
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    public void logout(String authorizationHeader) {
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            return;
        }

        extractBearerToken(authorizationHeader)
            .ifPresent(jwtService::parse);
    }

    public UserProfileResponse currentUser(AuthenticatedUser principal) {
        UserEntity user = userRepository.findById(UUID.fromString(principal.userId()))
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        return UserMapper.toProfile(user);
    }

    public UserProfileResponse updateProfile(AuthenticatedUser principal, UpdateProfileRequest request) {
        UserEntity user = userRepository.findById(UUID.fromString(principal.userId()))
                .orElseThrow(() -> new EntityNotFoundException("User not found"));

        if (request.fullName() != null && !request.fullName().isBlank()) {
            user.setFullName(request.fullName().trim());
        }
        if (request.phoneNumber() != null) {
            user.setPhoneNumber(blankToNull(request.phoneNumber()));
        }
        if (request.avatarUrl() != null) {
            user.setAvatarUrl(blankToNull(request.avatarUrl()));
        }

        return UserMapper.toProfile(userRepository.save(user));
    }

    public UserProfileResponse uploadAvatar(AuthenticatedUser principal, MultipartFile file) {
        UserEntity user = userRepository.findById(UUID.fromString(principal.userId()))
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        String oldAvatarUrl = user.getAvatarUrl();

        SupabaseStorageService.UploadedObject uploadedObject = supabaseStorageService.uploadAvatar(user.getId(), file);
        try {
            user.setAvatarUrl(uploadedObject.publicUrl());
            UserEntity saved = userRepository.save(user);
            if (oldAvatarUrl != null && !oldAvatarUrl.equals(uploadedObject.publicUrl())) {
                supabaseStorageService.deleteIfManagedAvatarUrl(oldAvatarUrl);
            }
            return UserMapper.toProfile(saved);
        } catch (RuntimeException exception) {
            supabaseStorageService.deleteObjectQuietly(uploadedObject.objectPath());
            throw exception;
        }
    }

    private AuthResponse buildAuthResponse(UserEntity user, long expirationSeconds) {
        UserProfileResponse profile = UserMapper.toProfile(user);
        String token = jwtService.generateToken(
                user.getId().toString(),
                user.getEmail(),
                user.getRoles().stream().toList(),
                Map.of("fullName", user.getFullName()),
                expirationSeconds
        );
        return new AuthResponse(token, expirationSeconds, profile);
    }

    private void ensureLoginAllowed(UserEntity user) {
        if (!"active".equalsIgnoreCase(user.getStatus())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "Tài khoản chưa được kích hoạt");
        }
        if (!user.isVerified()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "Email tài khoản chưa được xác thực");
        }
    }

    private String resolveRole(String role) {
        if (role == null || role.isBlank()) {
            return "CUSTOMER";
        }
        String normalized = role.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "SELLER" -> "SELLER";
            case "ADMIN" -> "ADMIN";
            default -> "CUSTOMER";
        };
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private Optional<String> extractBearerToken(String authorizationHeader) {
        String prefix = "Bearer ";
        if (!authorizationHeader.regionMatches(true, 0, prefix, 0, prefix.length())) {
            return Optional.empty();
        }

        String token = authorizationHeader.substring(prefix.length()).trim();
        return token.isEmpty() ? Optional.empty() : Optional.of(token);
    }
}
