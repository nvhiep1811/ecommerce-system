package com.ecommerce.catalog.controller;

import com.ecommerce.catalog.dto.ReviewResponse;
import com.ecommerce.catalog.dto.ReviewUpsertRequest;
import com.ecommerce.catalog.dto.ReviewsResponse;
import com.ecommerce.catalog.service.ReviewService;
import com.ecommerce.shared.security.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/catalog/reviews")
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @GetMapping("/products/{productId}")
    public ReviewsResponse productReviews(@PathVariable Long productId) {
        return reviewService.productReviews(productId);
    }

    @GetMapping("/mine")
    public ReviewsResponse mine(Authentication authentication) {
        return reviewService.mine((AuthenticatedUser) authentication.getPrincipal());
    }

    @GetMapping("/order-items/{orderItemId}/mine")
    public ReviewResponse myOrderItemReview(Authentication authentication, @PathVariable Long orderItemId) {
        return reviewService.myOrderItemReview((AuthenticatedUser) authentication.getPrincipal(), orderItemId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewResponse upsert(Authentication authentication, @Valid @RequestBody ReviewUpsertRequest request) {
        return reviewService.upsert((AuthenticatedUser) authentication.getPrincipal(), request);
    }
}
