package com.ecommerce.user.controller;

import com.ecommerce.shared.web.ApiExceptionHandler;
import com.ecommerce.shared.web.BusinessException;
import com.ecommerce.user.dto.AuthResponse;
import com.ecommerce.user.dto.UserProfileResponse;
import com.ecommerce.user.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;

    @InjectMocks
    private AuthController authController;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(authController)
                .setControllerAdvice(new ApiExceptionHandler())
                .setValidator(validator)
                .build();
    }

    @Test
    void registerReturnsAuthPayload() throws Exception {
        UUID userId = UUID.randomUUID();
        when(authService.register(any())).thenReturn(new AuthResponse(
                "jwt-token",
                86400L,
                new UserProfileResponse(
                        userId,
                        "buyer@example.com",
                        "Buyer Name",
                        null,
                        "0900000000",
                        OffsetDateTime.parse("2026-04-13T10:15:30+07:00"),
                        OffsetDateTime.parse("2026-04-13T10:15:30+07:00"),
                        "customer"
                )
        ));

        mockMvc.perform(post("/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "buyer@example.com",
                                  "password": "secret123",
                                  "fullName": "Buyer Name",
                                  "phoneNumber": "0900000000",
                                  "role": "customer"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("jwt-token"))
                .andExpect(jsonPath("$.user.id").value(userId.toString()))
                .andExpect(jsonPath("$.user.email").value("buyer@example.com"))
                .andExpect(jsonPath("$.user.fullName").value("Buyer Name"))
                .andExpect(jsonPath("$.user.role").value("customer"));
    }

    @Test
    void registerReturnsValidationErrorForInvalidPayload() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "not-an-email",
                                  "password": "123",
                                  "fullName": "",
                                  "phoneNumber": "0900000000"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.path").value("/auth/register"))
                .andExpect(jsonPath("$.details").isArray());
    }

    @Test
    void loginMapsBusinessExceptionToHttpError() throws Exception {
        when(authService.login(any())).thenThrow(new BusinessException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        mockMvc.perform(post("/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "buyer@example.com",
                                  "password": "wrong-password"
                                }
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.path").value("/auth/login"));
    }

        @Test
        void logoutReturnsNoContent() throws Exception {
                mockMvc.perform(post("/auth/logout")
                                                .header("Authorization", "Bearer mock-token"))
                                .andExpect(status().isNoContent());

                verify(authService).logout(eq("Bearer mock-token"));
        }
}
