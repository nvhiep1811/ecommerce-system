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
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new BusinessException(HttpStatus.CONFLICT, "Email already exists");
        }

        UserEntity entity = new UserEntity();
        entity.setId(UUID.randomUUID());
        entity.setEmail(request.email().trim().toLowerCase(Locale.ROOT));
        entity.setPasswordHash(passwordEncoder.encode(request.password()));
        entity.setFullName(request.fullName().trim());
        entity.setPhoneNumber(blankToNull(request.phoneNumber()));
        entity.setAvatarUrl(null);
        entity.setStatus("active");
        entity.setVerified(false);
        entity.setRoles(Set.of(resolveRole(request.role())));

        UserEntity saved = userRepository.save(entity);
        return buildAuthResponse(saved);
    }

    public AuthResponse login(LoginRequest request) {
        UserEntity user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new BusinessException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        return buildAuthResponse(user);
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

    private AuthResponse buildAuthResponse(UserEntity user) {
        UserProfileResponse profile = UserMapper.toProfile(user);
        String token = jwtService.generateToken(
                user.getId().toString(),
                user.getEmail(),
                user.getRoles().stream().toList(),
                Map.of("fullName", user.getFullName())
        );
        return new AuthResponse(token, profile);
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
}
