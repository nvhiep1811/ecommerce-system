package com.ecommerce.user.controller;

import com.ecommerce.user.dto.AuthResponse;
import com.ecommerce.user.dto.LoginRequest;
import com.ecommerce.user.dto.OtpRequest;
import com.ecommerce.user.dto.OtpResponse;
import com.ecommerce.user.dto.PasswordResetTokenResponse;
import com.ecommerce.user.dto.RegisterRequest;
import com.ecommerce.user.dto.ResetPasswordRequest;
import com.ecommerce.user.dto.VerifyPasswordResetOtpRequest;
import com.ecommerce.user.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestHeader;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/register/request-otp")
    public OtpResponse requestRegistrationOtp(@Valid @RequestBody OtpRequest request) {
        return authService.requestRegistrationOtp(request.email());
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(name = "Authorization", required = false) String authorizationHeader) {
        authService.logout(authorizationHeader);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password/forgot")
    public OtpResponse forgotPassword(@Valid @RequestBody OtpRequest request) {
        return authService.requestPasswordResetOtp(request.email());
    }

    @PostMapping("/password/verify-otp")
    public PasswordResetTokenResponse verifyPasswordResetOtp(@Valid @RequestBody VerifyPasswordResetOtpRequest request) {
        return authService.verifyPasswordResetOtp(request);
    }

    @PostMapping("/password/reset")
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.noContent().build();
    }
}
