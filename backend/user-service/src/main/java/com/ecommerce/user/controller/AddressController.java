package com.ecommerce.user.controller;

import com.ecommerce.shared.security.AuthenticatedUser;
import com.ecommerce.user.dto.AddressRequest;
import com.ecommerce.user.dto.AddressResponse;
import com.ecommerce.user.service.AddressService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class AddressController {

    private final AddressService addressService;

    public AddressController(AddressService addressService) {
        this.addressService = addressService;
    }

    @GetMapping("/users/addresses")
    public List<AddressResponse> list(Authentication authentication) {
        return addressService.list((AuthenticatedUser) authentication.getPrincipal());
    }

    @GetMapping("/users/addresses/{id}")
    public AddressResponse get(Authentication authentication, @PathVariable Long id) {
        return addressService.get((AuthenticatedUser) authentication.getPrincipal(), id);
    }

    @PostMapping("/users/addresses")
    @ResponseStatus(HttpStatus.CREATED)
    public AddressResponse create(Authentication authentication, @Valid @RequestBody AddressRequest request) {
        return addressService.create((AuthenticatedUser) authentication.getPrincipal(), request);
    }

    @PutMapping("/users/addresses/{id}")
    public AddressResponse update(Authentication authentication, @PathVariable Long id, @Valid @RequestBody AddressRequest request) {
        return addressService.update((AuthenticatedUser) authentication.getPrincipal(), id, request);
    }

    @DeleteMapping("/users/addresses/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication authentication, @PathVariable Long id) {
        addressService.delete((AuthenticatedUser) authentication.getPrincipal(), id);
    }

    @PostMapping("/users/addresses/{id}/default")
    public AddressResponse setDefault(Authentication authentication, @PathVariable Long id) {
        return addressService.setDefault((AuthenticatedUser) authentication.getPrincipal(), id);
    }

    @GetMapping("/internal/users/addresses/{id}")
    public AddressResponse getInternal(@PathVariable Long id) {
        return addressService.getInternal(id);
    }
}
