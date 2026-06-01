package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.dto.FavouriteResponse;
import com.ecommerce.catalog.dto.FavouriteStatusResponse;
import com.ecommerce.catalog.dto.FavouritesResponse;
import com.ecommerce.catalog.service.FavouriteService;
import com.ecommerce.shared.security.AuthenticatedUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/catalog/favourites")
public class FavouriteController {

    private final FavouriteService favouriteService;

    public FavouriteController(FavouriteService favouriteService) {
        this.favouriteService = favouriteService;
    }

    @GetMapping
    public FavouritesResponse list(Authentication authentication) {
        return favouriteService.list((AuthenticatedUser) authentication.getPrincipal());
    }

    @GetMapping("/{productId}")
    public FavouriteStatusResponse status(Authentication authentication, @PathVariable Long productId) {
        return favouriteService.status((AuthenticatedUser) authentication.getPrincipal(), productId);
    }

    @PostMapping("/{productId}")
    @ResponseStatus(HttpStatus.CREATED)
    public FavouriteResponse add(Authentication authentication, @PathVariable Long productId) {
        return favouriteService.add((AuthenticatedUser) authentication.getPrincipal(), productId);
    }

    @DeleteMapping("/{productId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(Authentication authentication, @PathVariable Long productId) {
        favouriteService.remove((AuthenticatedUser) authentication.getPrincipal(), productId);
    }
}
