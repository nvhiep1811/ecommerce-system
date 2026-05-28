package com.ecommerce.user.service;

import com.ecommerce.shared.web.BusinessException;
import com.ecommerce.user.domain.UserEntity;
import com.ecommerce.user.dto.AdminUserResponse;
import com.ecommerce.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Test
    void listUsersNormalizesFiltersAndMapsManagedAccounts() {
        AdminUserService service = new AdminUserService(userRepository);
        UserEntity seller = user("seller@example.com", "SELLER", "active");
        when(userRepository.findManagedAccounts("SELLER", "blocked", "seller")).thenReturn(List.of(seller));

        List<AdminUserResponse> response = service.listUsers(" seller ", " BLOCKED ", " Seller ");

        assertEquals(1, response.size());
        assertEquals("seller", response.get(0).role());
        assertEquals("active", response.get(0).status());
        verify(userRepository).findManagedAccounts("SELLER", "blocked", "seller");
    }

    @Test
    void updateStatusBlocksManagedAccount() {
        AdminUserService service = new AdminUserService(userRepository);
        UUID userId = UUID.randomUUID();
        UserEntity customer = user("buyer@example.com", "CUSTOMER", "active");
        customer.setId(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(customer));
        when(userRepository.save(customer)).thenReturn(customer);

        AdminUserResponse response = service.updateStatus(userId, "blocked");

        assertEquals("blocked", response.status());
        assertEquals("customer", response.role());
        verify(userRepository).save(customer);
    }

    @Test
    void updateStatusRejectsAdminAccount() {
        AdminUserService service = new AdminUserService(userRepository);
        UUID userId = UUID.randomUUID();
        UserEntity admin = user("admin@example.com", "ADMIN", "active");
        admin.setId(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(admin));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.updateStatus(userId, "blocked")
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        assertEquals("Only customer and seller accounts can be managed", exception.getMessage());
    }

    @Test
    void updateStatusRejectsUnknownStatus() {
        AdminUserService service = new AdminUserService(userRepository);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.updateStatus(UUID.randomUUID(), "disabled")
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        assertEquals("Status must be active, inactive, or blocked", exception.getMessage());
    }

    private UserEntity user(String email, String role, String status) {
        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        user.setFullName("Test User");
        user.setStatus(status);
        user.setVerified(true);
        user.setRoles(Set.of(role));
        user.setCreatedAt(OffsetDateTime.now().minusDays(1));
        user.setUpdatedAt(OffsetDateTime.now());
        return user;
    }
}
