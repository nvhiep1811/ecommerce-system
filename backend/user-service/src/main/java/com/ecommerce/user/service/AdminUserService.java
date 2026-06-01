package com.ecommerce.user.service;

import com.ecommerce.shared.web.BusinessException;
import com.ecommerce.user.domain.UserEntity;
import com.ecommerce.user.dto.AdminUserResponse;
import com.ecommerce.user.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminUserService {

    private static final Set<String> MANAGED_ROLES = Set.of("CUSTOMER", "SELLER");
    private static final Set<String> ALLOWED_STATUSES = Set.of("active", "inactive", "blocked");

    private final UserRepository userRepository;

    public AdminUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers(String role, String status, String keyword) {
        String normalizedRole = normalizeRole(role);
        String normalizedStatus = normalizeStatus(status);
        return userRepository.findManagedAccounts(normalizedRole, normalizedStatus, normalizeKeyword(keyword))
                .stream()
                .map(this::toAdminResponse)
                .toList();
    }

    @Transactional
    public AdminUserResponse updateStatus(UUID userId, String status) {
        String normalizedStatus = normalizeStatus(status);
        if (normalizedStatus == null) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Status is required");
        }

        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new EntityNotFoundException("User not found"));
        if (user.getRoles().stream().noneMatch(MANAGED_ROLES::contains)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Only customer and seller accounts can be managed");
        }

        user.setStatus(normalizedStatus);
        return toAdminResponse(userRepository.save(user));
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return null;
        }
        String normalized = role.trim().toUpperCase(Locale.ROOT);
        if (!MANAGED_ROLES.contains(normalized)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Role must be CUSTOMER or SELLER");
        }
        return normalized;
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_STATUSES.contains(normalized)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "Status must be active, inactive, or blocked");
        }
        return normalized;
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return keyword.trim().toLowerCase(Locale.ROOT);
    }

    private AdminUserResponse toAdminResponse(UserEntity user) {
        return new AdminUserResponse(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getAvatarUrl(),
                user.getPhoneNumber(),
                user.getStatus(),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                UserMapper.toMobileRole(user.getRoles()),
                Set.copyOf(user.getRoles())
        );
    }
}
