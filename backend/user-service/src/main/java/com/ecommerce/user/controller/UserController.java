package com.ecommerce.user.controller;

import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.user.dto.UpdateProfileRequest;
import com.ecommerce.user.dto.UserProfileResponse;
import com.ecommerce.user.service.AuthService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
public class UserController {

    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/me")
    public UserProfileResponse me(Authentication authentication) {
        return authService.currentUser((AuthenticatedUser) authentication.getPrincipal());
    }

    @PutMapping("/me")
    public UserProfileResponse update(Authentication authentication, @RequestBody UpdateProfileRequest request) {
        return authService.updateProfile((AuthenticatedUser) authentication.getPrincipal(), request);
    }
}
